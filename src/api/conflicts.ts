import type { Conflict, MetadataItem } from '@/types/metadata'
import { cleanLine } from '@/utils/whitespace'

interface DataEngine {
    query: (query: Record<string, unknown>) => Promise<Record<string, unknown>>
}

const PROPERTY_LABELS: Record<string, string> = {
    name: 'Name',
    shortName: 'Short name',
    code: 'Code',
}

// Names and short names must be unique per type, except for organisation
// units. Codes must always be unique. Options have no short name, their
// name only needs to be unique within their option set, and their code is
// never changed (see cleanableFields).
const uniqueFieldsForType = (
    type: string
): Array<'name' | 'shortName' | 'code'> => {
    if (type === 'organisationUnits') {
        return ['code']
    }
    return type === 'options' ? ['name'] : ['name', 'shortName', 'code']
}

// Options are only compared with options in the same option set
const scopeFilters = (type: string, item: MetadataItem): string[] =>
    type === 'options' && item.optionSet
        ? [`optionSet.id:eq:${item.optionSet.id}`]
        : []

const inSameScope = (type: string, a: MetadataItem, b: MetadataItem) =>
    type !== 'options' || a.optionSet?.id === b.optionSet?.id

const cleanedValue = (
    item: MetadataItem,
    field: 'name' | 'shortName' | 'code'
): string | undefined => {
    const value = item[field]
    if (typeof value !== 'string') {
        return undefined
    }
    const cleaned = cleanLine(value)
    // Whitespace-only values clean to '' - nothing to conflict with
    return cleaned === '' ? undefined : cleaned
}

/**
 * The filter that finds candidate duplicates of `value`. An eq filter is
 * exact: the server rejoins everything after the second ':' as the value,
 * so colons and brackets are safe. From 2.42 a comma in an eq value makes
 * it match nothing, so for those values search on the longest comma-free
 * part instead; callers compare the candidates exactly.
 */
export const conflictFilter = (field: string, value: string): string => {
    let longest = ''
    for (const part of value.split(',')) {
        if (part.trim().length > longest.length) {
            longest = part.trim()
        }
    }
    // An empty filter value is a server error, so a value of only commas
    // keeps the eq filter
    return value.includes(',') && longest !== ''
        ? `${field}:ilike:${longest}`
        : `${field}:eq:${value}`
}

/**
 * Finds objects that would conflict with `item` once its whitespace is
 * removed: existing objects on the server with the same (cleaned) name,
 * short name or code, plus any of the `peers` (other objects selected in
 * the same batch) that would be cleaned to the same value.
 */
export const findConflicts = async ({
    engine,
    type,
    item,
    peers = [],
}: {
    engine: DataEngine
    type: string
    item: MetadataItem
    peers?: MetadataItem[]
}): Promise<Conflict[]> => {
    const conflicts: Conflict[] = []
    const objectName = item.name ? cleanLine(item.name) : item.id
    const fields = uniqueFieldsForType(type)

    await Promise.all(
        fields.map(async (field) => {
            const value = cleanedValue(item, field)
            if (value === undefined) {
                return
            }
            const response = await engine.query({
                objects: {
                    resource: type,
                    params: {
                        filter: [
                            conflictFilter(field, value),
                            `id:!eq:${item.id}`,
                            ...scopeFilters(type, item),
                        ],
                        fields: `id,${field}`,
                        paging: false,
                    },
                },
            })
            const objects = response.objects as Record<string, unknown>
            const candidates = (objects?.[type] as Array<MetadataItem>) ?? []
            const matches = candidates.filter((c) => c[field] === value)
            for (const match of matches) {
                conflicts.push({
                    objectId: item.id,
                    objectName,
                    property: PROPERTY_LABELS[field],
                    conflictingObjectId: match.id,
                })
            }
        })
    )

    for (const peer of peers) {
        if (peer.id === item.id || !inSameScope(type, item, peer)) {
            continue
        }
        for (const field of fields) {
            const value = cleanedValue(item, field)
            const peerValue = cleanedValue(peer, field)
            if (value !== undefined && value === peerValue) {
                conflicts.push({
                    objectId: item.id,
                    objectName,
                    property: PROPERTY_LABELS[field],
                    conflictingObjectId: peer.id,
                })
            }
        }
    }

    return conflicts
}
