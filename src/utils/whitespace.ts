import type { CleanableField, MetadataItem } from '@/types/metadata'
import { CLEANABLE_FIELDS } from '@/types/metadata'

/** True when the string has leading/trailing whitespace or repeated whitespace */
export const needsCleaning = (value: unknown): value is string =>
    typeof value === 'string' && (/\s\s+/.test(value) || value.trim() !== value)

/** Collapse repeated whitespace to a single space and trim the ends */
export const cleanString = (value: string): string =>
    value.replace(/\s\s+/g, ' ').trim()

// Fields that other data refers to by their exact value. The tool shows
// their whitespace but never changes it:
// - an option's code is the value that tracker and aggregate data store,
//   and program rules and expressions compare against it;
// - program rules refer to a program rule variable by its name, #{name}.
const PROTECTED_FIELDS: Record<string, readonly CleanableField[]> = {
    options: ['code'],
    programRuleVariables: ['name'],
}

/** The fields the tool shows but never changes on objects of a type */
export const protectedFields = (type: string): readonly CleanableField[] =>
    PROTECTED_FIELDS[type] ?? []

/** The fields the tool may clean on objects of a metadata type */
export const cleanableFields = (type: string): readonly CleanableField[] =>
    CLEANABLE_FIELDS.filter((field) => !protectedFields(type).includes(field))

/** The subset of fields on an item that need cleaning */
export const fieldsNeedingCleaning = (
    item: MetadataItem,
    type: string
): CleanableField[] =>
    cleanableFields(type).filter((field) => needsCleaning(item[field]))

/** True when the tool can fix at least one of the item's issues */
export const isFixable = (item: MetadataItem, type: string): boolean =>
    fieldsNeedingCleaning(item, type).length > 0

/** True when any of the four fields has an issue, protected or not */
export const hasWhitespaceIssue = (item: MetadataItem): boolean =>
    CLEANABLE_FIELDS.some((field) => needsCleaning(item[field]))
