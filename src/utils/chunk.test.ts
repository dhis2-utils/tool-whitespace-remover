import { chunk } from './chunk'

describe('chunk', () => {
    it('splits evenly divisible arrays', () => {
        expect(chunk([1, 2, 3, 4], 2)).toEqual([
            [1, 2],
            [3, 4],
        ])
    })

    it('puts the remainder in a shorter final chunk', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    })

    it('returns a single chunk when size exceeds the array', () => {
        expect(chunk([1, 2], 10)).toEqual([[1, 2]])
    })

    it('returns no chunks for an empty array', () => {
        expect(chunk([], 3)).toEqual([])
    })

    it('does not mutate the input', () => {
        const input = [1, 2, 3]
        chunk(input, 2)
        expect(input).toEqual([1, 2, 3])
    })
})
