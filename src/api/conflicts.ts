import { Conflict, MetadataItem } from '@/types/metadata'
import { cleanString } from '@/utils/whitespace'

type DataEngine = {
    query: (query: Record<string, unknown>) => Promise<Record<string, unknown>>
}

const PROPERTY_LABELS: Record<string, string> = {
    name: 'Name',
    shortName: 'Short name',
    code: 'Code',
}

// Names and short names must be unique per type, except for organisation
// units. Codes must always be unique.
const uniqueFieldsForType = (
    type: string
): Array<'name' | 'shortName' | 'code'> =>
    type === 'organisationUnits' ? ['code'] : ['name', 'shortName', 'code']

const cleanedValue = (
    item: MetadataItem,
    field: 'name' | 'shortName' | 'code'
): string | undefined => {
    const value = item[field]
    if (typeof value !== 'string') {
        return undefined
    }
    const cleaned = cleanString(value)
    // Whitespace-only values clean to '' - nothing to conflict with
    return cleaned === '' ? undefined : cleaned
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
    const objectName = item.name ? cleanString(item.name) : item.id
    const fields = uniqueFieldsForType(type)

    await Promise.all(
        fields.map(async (field) => {
            const value = cleanedValue(item, field)
            if (value === undefined) {
                return
            }
            // Only single-value operators (eq/!eq) are used here: the server
            // rejoins everything after the second ':' as the value, so
            // colons, commas and brackets in metadata values are safe.
            // Multi-value operators (in:[...]) would not be.
            const response = await engine.query({
                objects: {
                    resource: type,
                    params: {
                        filter: [`${field}:eq:${value}`, `id:!eq:${item.id}`],
                        fields: 'id',
                        pageSize: 50,
                    },
                },
            })
            const objects = response.objects as Record<string, unknown>
            const matches = (objects?.[type] as Array<{ id: string }>) ?? []
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
        if (peer.id === item.id) {
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
