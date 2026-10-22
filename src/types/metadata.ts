export const CLEANABLE_FIELDS = [
    'name',
    'shortName',
    'code',
    'description',
] as const

export type CleanableField = (typeof CLEANABLE_FIELDS)[number]

export type MetadataItem = {
    id: string
    // only set on options; their names and codes are unique per option set
    optionSet?: { id: string }
} & Partial<Record<CleanableField, string>>

/** Metadata type (e.g. "dataElements") -> objects with whitespace issues */
export type MetadataMap = Record<string, MetadataItem[]>

export type RowStatus =
    | 'unchecked'
    | 'checking'
    | 'ready'
    | 'conflict'
    | 'fixing'
    | 'error'

export interface Conflict {
    objectId: string
    objectName: string
    property: string
    conflictingObjectId: string
}

export interface FixError {
    id: string
    name: string
    message: string
}
