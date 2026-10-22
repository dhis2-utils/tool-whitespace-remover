export type Schema = {
    plural: string
    metadata: boolean
    persisted: boolean
    relativeApiEndpoint?: string
}

// A JSON patch to an analytical object, even of an unrelated field, nulls
// the data element of every data element operand it uses, and the object
// can no longer be opened (DHIS2 core, seen on 2.41-2.43). Never patch them.
const UNSAFE_TYPES = new Set([
    'visualizations',
    'eventVisualizations',
    'maps',
    'eventReports',
    'eventCharts',
])

// Only persisted metadata types with their own API endpoint can be patched
// via /api/<type>/<id>; anything else (read-only/embedded types) would fail
// at fix time, so keep it out of the scan results.
export const patchableTypes = (schemas: Schema[]): Set<string> =>
    new Set(
        schemas
            .filter((s) => s.metadata && s.persisted && s.relativeApiEndpoint)
            .map((s) => s.plural)
            .filter((plural) => !UNSAFE_TYPES.has(plural))
    )
