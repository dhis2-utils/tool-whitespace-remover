import type { CleanableField, MetadataItem } from '@/types/metadata'
import { CLEANABLE_FIELDS } from '@/types/metadata'

/** True when the string has leading/trailing whitespace or repeated whitespace */
export const needsCleaning = (value: unknown): value is string =>
    typeof value === 'string' && (/\s\s+/.test(value) || value.trim() !== value)

/** Collapse repeated whitespace to a single space and trim the ends */
export const cleanString = (value: string): string =>
    value.replace(/\s\s+/g, ' ').trim()

// An option's code is the value that tracker and aggregate data store, and
// program rules and expressions compare against it. Changing it would cut
// stored values off from their option, so it is never cleaned.
const OPTION_FIELDS = CLEANABLE_FIELDS.filter((field) => field !== 'code')

/** The fields the tool may clean on objects of a metadata type */
export const cleanableFields = (type: string): readonly CleanableField[] =>
    type === 'options' ? OPTION_FIELDS : CLEANABLE_FIELDS

/** The subset of fields on an item that need cleaning */
export const fieldsNeedingCleaning = (
    item: MetadataItem,
    type: string
): CleanableField[] =>
    cleanableFields(type).filter((field) => needsCleaning(item[field]))

export const hasWhitespaceIssue = (item: MetadataItem, type: string): boolean =>
    fieldsNeedingCleaning(item, type).length > 0
