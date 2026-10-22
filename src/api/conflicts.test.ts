import { conflictFilter, findConflicts } from './conflicts'

describe('conflictFilter', () => {
    it('uses an exact match for values without a comma', () => {
        expect(conflictFilter('name', 'a:b [c] (d)')).toBe(
            'name:eq:a:b [c] (d)'
        )
    })

    it('searches on the longest comma-free part when the value has a comma', () => {
        // 2.42+ splits eq values on commas, so the filter must avoid them
        expect(conflictFilter('name', 'ANC, first visit')).toBe(
            'name:ilike:first visit'
        )
    })

    it('never sends an empty filter value', () => {
        expect(conflictFilter('code', ',,')).toBe('code:eq:,,')
    })

    it('never puts a comma in the filter value', () => {
        for (const value of ['a,b', 'x, y, zz', 'one,two,three']) {
            expect(
                conflictFilter('code', value).split(':ilike:')[1]
            ).not.toMatch(',')
        }
    })
})

describe('findConflicts', () => {
    type Query = {
        objects: { resource: string; params: { filter: string[] } }
    }

    // Answers every query with the same candidates, as the server would
    // for a filter they all match
    const engineReturning = (objects: object[]) => {
        const queries: Query['objects']['params'][] = []
        return {
            queries,
            query: async (query: Record<string, unknown>) => {
                const { resource, params } = (query as Query).objects
                queries.push(params)
                return { objects: { [resource]: objects } }
            },
        }
    }

    const option = (id: string, name: string, optionSet: string) => ({
        id,
        name,
        code: `${id}_CODE`,
        optionSet: { id: optionSet },
    })

    it('only reports exact matches among the candidates', async () => {
        const engine = engineReturning([
            { id: 'other000001', name: 'A, b' },
            { id: 'other000002', name: 'A, b extra' },
        ])
        const conflicts = await findConflicts({
            engine,
            type: 'dataElements',
            item: { id: 'item0000001', name: 'A,  b ' },
        })
        expect(conflicts.map((c) => c.conflictingObjectId)).toEqual([
            'other000001',
        ])
    })

    it('scopes option checks to the option set and skips short names', async () => {
        const engine = engineReturning([])
        await findConflicts({
            engine,
            type: 'options',
            item: option('opt00000001', 'Yes ', 'set00000001'),
        })
        expect(engine.queries.map((q) => q.filter[0])).toEqual([
            'name:eq:Yes',
            'code:eq:opt00000001_CODE',
        ])
        for (const params of engine.queries) {
            expect(params.filter).toContain('optionSet.id:eq:set00000001')
        }
    })

    it('compares options only with peers in the same option set', async () => {
        const item = option('opt00000001', 'Yes ', 'set00000001')
        const conflicts = await findConflicts({
            engine: engineReturning([]),
            type: 'options',
            item,
            peers: [
                option('opt00000002', 'Yes', 'set00000002'),
                option('opt00000003', ' Yes', 'set00000001'),
            ],
        })
        expect(conflicts.map((c) => c.conflictingObjectId)).toEqual([
            'opt00000003',
        ])
    })
})
