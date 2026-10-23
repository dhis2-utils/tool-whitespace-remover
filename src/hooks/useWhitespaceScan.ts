import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { MetadataItem, MetadataMap } from '@/types/metadata'
import type { Schema } from '@/utils/patchableTypes'
import { patchableTypes, shortNameTypes } from '@/utils/patchableTypes'
import { hasWhitespaceIssue } from '@/utils/whitespace'

const FIELDS = 'id,name,shortName,code,description,optionSet[id]'

const NBSP = '\u00A0'

// The server finds candidates; the app keeps the ones that cleaning would
// change (hasWhitespaceIssue), so a filter may match more than it needs to.
// ilike: contains, $ilike: starts with, ilike$: ends with.

// Names, short names and codes: repeated, leading and trailing spaces, and
// any newline, carriage return, tab or non-breaking space
const lineFilters = (field: string): string[] => [
    `${field}:ilike:  `,
    `${field}:$ilike: `,
    `${field}:ilike$: `,
    ...['\n', '\r', '\t', NBSP].map((char) => `${field}:ilike:${char}`),
]

// Descriptions keep their line breaks: leading and trailing whitespace of
// any kind, repeated spaces, spaces before a line break, tabs and
// non-breaking spaces
const textFilters = (field: string): string[] => [
    `${field}:ilike:  `,
    `${field}:ilike: \n`,
    `${field}:ilike: \r`,
    `${field}:ilike:\t`,
    `${field}:ilike:${NBSP}`,
    ...[' ', '\n', '\r'].flatMap((char) => [
        `${field}:$ilike:${char}`,
        `${field}:ilike$:${char}`,
    ]),
]

const mergeResponses = (
    responses: Record<string, unknown>[],
    allowedTypes: Set<string>
): MetadataMap => {
    const merged: MetadataMap = {}
    for (const response of responses) {
        for (const [type, value] of Object.entries(response)) {
            if (!allowedTypes.has(type) || !Array.isArray(value)) {
                continue
            }
            merged[type] = [
                ...(merged[type] ?? []),
                ...(value as MetadataItem[]),
            ]
        }
    }
    for (const type of Object.keys(merged)) {
        const seen = new Set<string>()
        merged[type] = merged[type]
            .filter((item) => {
                if (seen.has(item.id) || !hasWhitespaceIssue(item)) {
                    return false
                }
                seen.add(item.id)
                return true
            })
            .sort((a, b) =>
                (a.name ?? '').localeCompare(b.name ?? '', undefined, {
                    sensitivity: 'base',
                })
            )
        if (merged[type].length === 0) {
            delete merged[type]
        }
    }
    return merged
}

/**
 * Scans all metadata for whitespace issues in name, short name, code and
 * description (one /api/metadata call per field/pattern combination) and
 * returns the matching objects grouped by metadata type.
 */
export const useWhitespaceScan = () => {
    const engine = useDataEngine()
    const [progress, setProgress] = useState(0)

    const query = useQuery<MetadataMap, Error>(
        ['whitespace-scan'],
        async () => {
            // across all metadata types at once
            const filters = [
                ...lineFilters('name'),
                ...lineFilters('code'),
                ...textFilters('description'),
            ]
            const shortNameFilters = lineFilters('shortName')
            const totalRequests = filters.length + shortNameFilters.length + 1 // + schemas
            let completed = 0
            setProgress(0)
            const tick = () => {
                completed += 1
                setProgress(completed / totalRequests)
            }

            const schemasPromise = engine
                .query({
                    schemas: {
                        resource: 'schemas',
                        params: {
                            fields: 'plural,metadata,persisted,relativeApiEndpoint,properties[name,persisted]',
                        },
                    },
                })
                .then((response) => {
                    tick()
                    return (
                        response.schemas as unknown as { schemas: Schema[] }
                    ).schemas
                })

            const scan = async (
                filter: string,
                types: Record<string, boolean> = {}
            ) => {
                const response = await engine.query({
                    metadata: {
                        resource: 'metadata',
                        params: { filter, fields: FIELDS, ...types },
                    },
                })
                tick()
                return response.metadata as Record<string, unknown>
            }

            // A shortName filter is only accepted when the request is
            // limited to the types that have one (dataElements=true&...),
            // so those requests wait for the schemas
            const shortNameResponses = schemasPromise.then((schemas) => {
                const types = Object.fromEntries(
                    shortNameTypes(schemas).map((type) => [type, true])
                )
                return Object.keys(types).length > 0
                    ? Promise.all(
                          shortNameFilters.map((filter) => scan(filter, types))
                      )
                    : []
            })
            const responses = await Promise.all(
                filters.map((filter) => scan(filter))
            )
            const schemas = await schemasPromise
            return mergeResponses(
                [...responses, ...(await shortNameResponses)],
                patchableTypes(schemas)
            )
        },
        {
            staleTime: Infinity,
            cacheTime: Infinity,
            refetchOnWindowFocus: false,
            retry: 1,
        }
    )

    return { ...query, progress }
}
