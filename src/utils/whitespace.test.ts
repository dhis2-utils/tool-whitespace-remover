import {
    cleanableFields,
    isFixable,
    protectedFields,
    cleanValue,
    fieldsNeedingCleaning,
    hasWhitespaceIssue,
    needsCleaning,
    problemRun,
} from './whitespace'

const DE = 'dataElements'

const NBSP = '\u00A0'

describe('needsCleaning in names, short names and codes', () => {
    it.each([
        ' leading',
        'trailing ',
        '  both  ',
        'double  interior',
        'tab\ttab',
        'line\nbreak',
        'Bladder Cancer\r',
        `non${NBSP}breaking`,
        ' ',
        '\t',
    ])('flags %j', (value) => {
        expect(needsCleaning('name', value)).toBe(true)
    })

    it.each(['clean', 'single interior space', 'a b c', ''])(
        'accepts %j',
        (value) => {
            expect(needsCleaning('code', value)).toBe(false)
        }
    )

    it.each([undefined, null, 42, {}, ['  ']])(
        'is false for non-string %p',
        (value) => {
            expect(needsCleaning('name', value)).toBe(false)
        }
    )
})

describe('needsCleaning in descriptions', () => {
    it.each([
        'Para one.\n\nPara two.',
        'Value "1" = include\nValue "0" = exclude',
        'Steps:\n- first\n- second',
        'Windows\r\nline endings',
        'Intro:\n  indented line',
        'a single\ttab',
    ])('keeps the line breaks and layout of %j', (value) => {
        expect(needsCleaning('description', value)).toBe(false)
    })

    it.each([
        ' leading',
        'trailing\n',
        'label. \nA vaccine',
        'double  space',
        'tabs\t\there',
        '\r\nstarts with a line break',
    ])('flags %j', (value) => {
        expect(needsCleaning('description', value)).toBe(true)
    })
})

describe('cleanValue', () => {
    it.each([
        [' leading', 'leading'],
        ['trailing ', 'trailing'],
        ['double  interior', 'double interior'],
        ['a \t b', 'a b'],
        ['Bladder Cancer\r', 'Bladder Cancer'],
        ['line\r\nbreak', 'line break'],
        [`non${NBSP}breaking`, 'non breaking'],
        [' ', ''],
        ['', ''],
    ])('cleans the name %j to %j', (input, expected) => {
        expect(cleanValue('name', input)).toBe(expected)
    })

    it.each([
        ['label. \nA vaccine', 'label.\nA vaccine'],
        ['Para one.  \n\nPara two. ', 'Para one.\n\nPara two.'],
        ['a  b\nc', 'a b\nc'],
        ['\n\ntext\n', 'text'],
        ['Intro:\n  indented line', 'Intro:\n  indented line'],
        ['Windows \r\nline', 'Windows\r\nline'],
    ])('cleans the description %j to %j', (input, expected) => {
        expect(cleanValue('description', input)).toBe(expected)
    })

    it('produces values that no longer need cleaning', () => {
        const samples = [' a ', 'a  b', '\t\tx\t\t', '  ', 'a \n b  c ', 'x\r']
        for (const field of ['name', 'description'] as const) {
            for (const value of samples) {
                expect(needsCleaning(field, cleanValue(field, value))).toBe(
                    false
                )
            }
        }
    })

    it('is idempotent', () => {
        const samples = [' a ', 'a  b', 'clean', 'a\tb', '  x  y  ', 'p.\n\nq ']
        for (const field of ['code', 'description'] as const) {
            for (const value of samples) {
                const once = cleanValue(field, value)
                expect(cleanValue(field, once)).toBe(once)
            }
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

describe('problemRun', () => {
    const runs = (value: string, field: 'name' | 'description') =>
        [...value.matchAll(/\s+/g)]
            .filter((m) => problemRun(field, value, m))
            .map((m) => m[0])

    it('marks every whitespace run in a name except single spaces', () => {
        expect(runs(' a b\tc  d\r', 'name')).toEqual([' ', '\t', '  ', '\r'])
    })

    it('leaves intended line breaks in a description unmarked', () => {
        expect(runs('a b\n\nc  d \ne\n', 'description')).toEqual([
            '  ',
            ' \n',
            '\n',
        ])
    })
})
