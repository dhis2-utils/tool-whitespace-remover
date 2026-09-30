import {
    CLEANABLE_FIELDS,
    CleanableField,
    MetadataItem,
} from '@/types/metadata'

/** True when the string has leading/trailing whitespace or repeated whitespace */
export const needsCleaning = (value: unknown): value is string =>
    typeof value === 'string' && (/\s\s+/.test(value) || value.trim() !== value)

/** Collapse repeated whitespace to a single space and trim the ends */
export const cleanString = (value: string): string =>
    value.replace(/\s\s+/g, ' ').trim()

/** The subset of fields on an item that need cleaning */
export const fieldsNeedingCleaning = (item: MetadataItem): CleanableField[] =>
    CLEANABLE_FIELDS.filter((field) => needsCleaning(item[field]))

export const hasWhitespaceIssue = (item: MetadataItem): boolean =>
    fieldsNeedingCleaning(item).length > 0
