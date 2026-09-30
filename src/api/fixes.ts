import { FixError, MetadataItem } from '@/types/metadata'
import { cleanString, fieldsNeedingCleaning } from '@/utils/whitespace'

type DataEngine = {
    mutate: (mutation: unknown) => Promise<unknown>
}

export type FixResult = {
    fixedIds: string[]
    errors: FixError[]
}

/**
 * Removes the whitespace issues on a single object with a JSON-patch,
 * only touching the fields that actually need cleaning.
 */
export const fixItem = async (
    engine: DataEngine,
    type: string,
    item: MetadataItem
): Promise<void> => {
    const operations = fieldsNeedingCleaning(item).map((field) => ({
        op: 'add',
        path: `/${field}`,
        value: cleanString(item[field] as string),
    }))
    await engine.mutate({
        resource: type,
        id: item.id,
        type: 'json-patch',
        data: operations,
    })
}

export const fixItems = async (
    engine: DataEngine,
    type: string,
    items: MetadataItem[]
): Promise<FixResult> => {
    const fixedIds: string[] = []
    const errors: FixError[] = []
    await Promise.all(
        items.map(async (item) => {
            try {
                await fixItem(engine, type, item)
                fixedIds.push(item.id)
            } catch (error) {
                errors.push({
                    id: item.id,
                    name: item.name ?? item.id,
                    message:
                        error instanceof Error ? error.message : String(error),
                })
            }
        })
    )
    return { fixedIds, errors }
}
