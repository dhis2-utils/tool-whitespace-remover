import {
    cleanString,
    fieldsNeedingCleaning,
    hasWhitespaceIssue,
    needsCleaning,
} from './whitespace'

describe('needsCleaning', () => {
    it.each([
        ' leading',
        'trailing ',
        '  both  ',
        'double  interior',
        'tab\t\ttab',
        'line\n\nbreak',
        ' ',
        '\t',
    ])('flags %j', (value) => {
        expect(needsCleaning(value)).toBe(true)
    })

    it.each(['clean', 'single interior space', 'a b c', ''])(
        'accepts %j',
        (value) => {
            expect(needsCleaning(value)).toBe(false)
        }
    )

    it('accepts a single interior tab (only repeated whitespace is flagged)', () => {
        expect(needsCleaning('a\tb')).toBe(false)
    })

    it.each([undefined, null, 42, {}, ['  ']])(
        'is false for non-string %p',
        (value) => {
            expect(needsCleaning(value)).toBe(false)
        }
    )
})

describe('cleanString', () => {
    it.each([
        [' leading', 'leading'],
        ['trailing ', 'trailing'],
        ['  both  ', 'both'],
        ['double  interior', 'double interior'],
        ['a \t b', 'a b'],
        ['tab\t\ttab', 'tab tab'],
        ['line\n\nbreak', 'line break'],
        [' ', ''],
        ['a b', 'a b'],
        ['', ''],
    ])('cleans %j to %j', (input, expected) => {
        expect(cleanString(input)).toBe(expected)
    })

    it('produces values that no longer need cleaning', () => {
        const samples = [' a ', 'a  b', '\t\tx\t\t', '  ', 'a \n b  c ']
        for (const value of samples) {
            expect(needsCleaning(cleanString(value))).toBe(false)
        }
    })

    it('is idempotent', () => {
        const samples = [' a ', 'a  b', 'clean', 'a\tb', '  x  y  ']
        for (const value of samples) {
            expect(cleanString(cleanString(value))).toBe(cleanString(value))
        }
    })
})

describe('fieldsNeedingCleaning', () => {
    it('returns exactly the cleanable fields with issues', () => {
        expect(
            fieldsNeedingCleaning({
                id: 'abc12345678',
                name: ' bad',
                shortName: 'ok',
                code: 'bad  code',
                description: undefined,
            })
        ).toEqual(['name', 'code'])
    })

    it('returns an empty list for a clean item', () => {
        expect(
            fieldsNeedingCleaning({ id: 'abc12345678', name: 'ok' })
        ).toEqual([])
    })

    it('ignores whitespace in non-cleanable properties', () => {
        const item = { id: 'abc12345678', name: 'ok', other: ' bad ' }
        expect(fieldsNeedingCleaning(item)).toEqual([])
    })
})

describe('hasWhitespaceIssue', () => {
    it('is true when any cleanable field has an issue', () => {
        expect(hasWhitespaceIssue({ id: 'abc12345678', shortName: 'x ' })).toBe(
            true
        )
    })

    it('is false when all cleanable fields are clean or absent', () => {
        expect(hasWhitespaceIssue({ id: 'abc12345678' })).toBe(false)
        expect(hasWhitespaceIssue({ id: 'abc12345678', name: 'a b' })).toBe(
            false
        )
    })
})
