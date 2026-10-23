import type { CleanableField, MetadataItem } from '@/types/metadata'
import { CLEANABLE_FIELDS } from '@/types/metadata'

// Names, short names and codes are single-line values: every run of
// whitespace (newlines, carriage returns, tabs, non-breaking spaces, repeated
// spaces) becomes one space. Descriptions keep their line breaks: only the
// ends, the spaces and tabs at the end of a line, and repeated spaces and
// tabs between words are cleaned.
const ANY_WHITESPACE = /\s+/g
// spaces and tabs (any whitespace except line breaks) before a line break
const BEFORE_LINE_BREAK = /[^\S\r\n]+(?=\r\n|\r|\n)/g
// two or more spaces or tabs between two words
const REPEATED_IN_LINE = /(\S)[^\S\r\n]{2,}(?=\S)/g
const LINE_BREAK = /[\r\n]/
const HORIZONTAL_BEFORE_BREAK = /^[^\S\r\n]+[\r\n]/

/** A name, short name or code on one line, with single spaces */
export const cleanLine = (value: string): string =>
    value.replace(ANY_WHITESPACE, ' ').trim()

/** A description with its line breaks kept and the rest of its whitespace cleaned */
export const cleanText = (value: string): string =>
    value.replace(BEFORE_LINE_BREAK, '').replace(REPEATED_IN_LINE, '$1 ').trim()

/** The cleaned value of a field */
export const cleanValue = (field: CleanableField, value: string): string =>
    field === 'description' ? cleanText(value) : cleanLine(value)

/** True when cleaning would change the value of a field */
export const needsCleaning = (
    field: CleanableField,
    value: unknown
): value is string =>
    typeof value === 'string' && cleanValue(field, value) !== value

/**
 * Whether a run of whitespace in a value, as matched by /\s+/g, is one the
 * tool removes, so the table can highlight it.
 */
export const problemRun = (
    field: CleanableField,
    value: string,
    match: RegExpMatchArray
): boolean => {
    const index = match.index ?? 0
    const run = match[0]
    if (index === 0 || index + run.length === value.length) {
        return true
    }
    if (field !== 'description') {
        return run !== ' '
    }
    return LINE_BREAK.test(run)
        ? HORIZONTAL_BEFORE_BREAK.test(run)
        : run.length >= 2
}

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
    cleanableFields(type).filter((field) => needsCleaning(field, item[field]))

/** True when the tool can fix at least one of the item's issues */
export const isFixable = (item: MetadataItem, type: string): boolean =>
    fieldsNeedingCleaning(item, type).length > 0

/** True when any of the four fields has an issue, protected or not */
export const hasWhitespaceIssue = (item: MetadataItem): boolean =>
    CLEANABLE_FIELDS.some((field) => needsCleaning(field, item[field]))
