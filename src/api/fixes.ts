import type { FixError, MetadataItem } from '@/types/metadata'
import { cleanValue, fieldsNeedingCleaning } from '@/utils/whitespace'

interface DataEngine {
    mutate: (mutation: unknown) => Promise<unknown>
}

export interface FixResult {
    fixedIds: string[]
    errors: FixError[]
}

interface ErrorReports {
    message?: string
    response?: { errorReports?: Array<{ message: string }> }
}

/**
 * The reason a fix failed. DHIS2 answers a rejected patch with a generic
 * message; the actual reasons are in the import report's error reports.
 */
export const fixErrorMessage = (error: unknown): string => {
    const details = (error as { details?: ErrorReports } | null)?.details
    const reports = details?.response?.errorReports ?? []
    if (reports.length > 0) {
        return reports.map((report) => report.message).join('; ')
    }
    if (details?.message) {
        return details.message
    }
    return error instanceof Error ? error.message : String(error)
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
    const operations = fieldsNeedingCleaning(item, type).map((field) => ({
        op: 'add',
        path: `/${field}`,
        value: cleanValue(field, item[field] as string),
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
                    message: fixErrorMessage(error),
                })
            }
        })
    )
    return { fixedIds, errors }
}
