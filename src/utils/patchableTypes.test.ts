import { patchableTypes, shortNameTypes } from './patchableTypes'

const schema = (plural: string, overrides = {}) => ({
    plural,
    metadata: true,
    persisted: true,
    relativeApiEndpoint: `/${plural}`,
    ...overrides,
})

describe('patchableTypes', () => {
    it('keeps persisted metadata types with their own endpoint', () => {
        const types = patchableTypes([
            schema('dataElements'),
            schema('organisationUnits'),
        ])
        expect([...types].sort()).toEqual(['dataElements', 'organisationUnits'])
    })

    it('drops non-metadata, non-persisted and endpoint-less types', () => {
        const types = patchableTypes([
            schema('a', { metadata: false }),
            schema('b', { persisted: false }),
            schema('c', { relativeApiEndpoint: undefined }),
        ])
        expect(types.size).toBe(0)
    })

    it.each([
        'visualizations',
        'eventVisualizations',
        'maps',
        'eventReports',
        'eventCharts',
    ])('never offers %s, which JSON patch corrupts', (plural) => {
        expect(patchableTypes([schema(plural)]).has(plural)).toBe(false)
    })
})

describe('shortNameTypes', () => {
    const withShortName = (plural: string, persisted = true) =>
        schema(plural, { properties: [{ name: 'shortName', persisted }] })

    it('keeps the patchable types that store a short name', () => {
        expect(
            shortNameTypes([
                withShortName('dataElements'),
                schema('constants', {
                    properties: [{ name: 'name', persisted: true }],
                }),
                withShortName('derived', false),
            ])
        ).toEqual(['dataElements'])
    })

    it('never includes types that are not patchable', () => {
        expect(
            shortNameTypes([
                withShortName('visualizations'),
                {
                    ...withShortName('readOnly'),
                    relativeApiEndpoint: undefined,
                },
            ])
        ).toEqual([])
    })
})
