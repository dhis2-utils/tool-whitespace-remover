export const CLEANABLE_FIELDS = [
    'name',
    'shortName',
    'code',
    'description',
] as const

export type CleanableField = (typeof CLEANABLE_FIELDS)[number]

export type MetadataItem = {
    id: string
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

export type Conflict = {
    objectId: string
    objectName: string
    property: string
    conflictingObjectId: string
}

export type FixError = {
    id: string
    name: string
    message: string
}
