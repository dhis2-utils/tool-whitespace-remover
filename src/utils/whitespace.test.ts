import {
    cleanableFields,
    isFixable,
    protectedFields,
    cleanString,
    fieldsNeedingCleaning,
    hasWhitespaceIssue,
    needsCleaning,
} from './whitespace'

const DE = 'dataElements'

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
            fieldsNeedingCleaning(
                {
                    id: 'abc12345678',
                    name: ' bad',
                    shortName: 'ok',
                    code: 'bad  code',
                    description: undefined,
                },
                DE
            )
        ).toEqual(['name', 'code'])
    })

    it('never cleans the code of an option, which data stores', () => {
        expect(
            fieldsNeedingCleaning(
                { id: 'abc12345678', name: ' bad', code: 'bad  code' },
                'options'
            )
        ).toEqual(['name'])
    })

    it('returns an empty list for a clean item', () => {
        expect(
            fieldsNeedingCleaning({ id: 'abc12345678', name: 'ok' }, DE)
        ).toEqual([])
    })

    it('ignores whitespace in non-cleanable properties', () => {
        const item = { id: 'abc12345678', name: 'ok', other: ' bad ' }
        expect(fieldsNeedingCleaning(item, DE)).toEqual([])
    })
})

describe('cleanableFields', () => {
    it('cleans all four fields for most types', () => {
        expect(cleanableFields(DE)).toEqual([
            'name',
            'shortName',
            'code',
            'description',
        ])
    })

    it('leaves out the code for options', () => {
        expect(cleanableFields('options')).not.toContain('code')
    })
})

describe('protectedFields', () => {
    it('protects option codes and program rule variable names', () => {
        expect(protectedFields('options')).toEqual(['code'])
        expect(protectedFields('programRuleVariables')).toEqual(['name'])
        expect(protectedFields(DE)).toEqual([])
    })

    it('never lets the tool clean a protected field', () => {
        expect(cleanableFields('programRuleVariables')).not.toContain('name')
    })
})

describe('isFixable', () => {
    const codeOnly = { id: 'abc12345678', name: 'ok', code: 'x ' }

    it('is false when the only issues are in protected fields', () => {
        expect(isFixable(codeOnly, 'options')).toBe(false)
        expect(
            isFixable(
                { id: 'abc12345678', name: 'var ' },
                'programRuleVariables'
            )
        ).toBe(false)
    })

    it('is true when a field the tool may clean has an issue', () => {
        expect(isFixable({ ...codeOnly, name: 'yes ' }, 'options')).toBe(true)
        expect(isFixable(codeOnly, DE)).toBe(true)
    })
})

describe('hasWhitespaceIssue', () => {
    it('lists an object whose only issue is in a protected field', () => {
        expect(
            hasWhitespaceIssue({ id: 'abc12345678', name: 'ok', code: 'x ' })
        ).toBe(true)
    })

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
