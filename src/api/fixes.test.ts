import { fixErrorMessage } from './fixes'

const fetchError = (details: unknown) =>
    Object.assign(new Error('One or more errors occurred'), { details })

describe('fixErrorMessage', () => {
    it('shows the error reports from the server response', () => {
        const error = fetchError({
            response: {
                errorReports: [
                    {
                        message:
                            'Property `name` with value `X` must be unique',
                    },
                    { message: 'Second problem' },
                ],
            },
        })
        expect(fixErrorMessage(error)).toBe(
            'Property `name` with value `X` must be unique; Second problem'
        )
    })

    it('falls back to the error message without error reports', () => {
        expect(fixErrorMessage(fetchError({ response: {} }))).toBe(
            'One or more errors occurred'
        )
        expect(fixErrorMessage(new Error('Network down'))).toBe('Network down')
    })

    it('handles non-Error values', () => {
        expect(fixErrorMessage('boom')).toBe('boom')
    })
})
