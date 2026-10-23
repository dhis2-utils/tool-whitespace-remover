import type { ReactNode } from 'react'
import React from 'react'
import styles from './WhitespaceHighlight.module.css'
import type { CleanableField } from '@/types/metadata'
import { problemRun } from '@/utils/whitespace'

const WHITESPACE_RUN = /\s+/g

// Whitespace that is invisible on its own gets a symbol inside a highlight;
// a newline keeps its line break after the symbol. Other Unicode spaces
// show as a middle dot.
const SYMBOLS: Record<string, string> = {
    ' ': ' ',
    '\n': '↵\n',
    '\r': '␍',
    '\t': '⇥',
    '\u00A0': '⍽',
}

const showWhitespace = (run: string): string =>
    [...run].map((char) => SYMBOLS[char] ?? '·').join('')

/**
 * Renders a metadata value in quotes, with the whitespace that cleaning
 * removes highlighted: yellow where the tool removes it, red in a field the
 * tool never changes.
 */
export const WhitespaceHighlight = ({
    field,
    value,
    isProtected = false,
}: {
    field: CleanableField
    value?: string
    isProtected?: boolean
}) => {
    if (value === undefined || value === '') {
        return null
    }
    const markClass = isProtected ? styles.protected : styles.whitespace
    const segments: ReactNode[] = []
    let last = 0
    for (const match of value.matchAll(WHITESPACE_RUN)) {
        if (!problemRun(field, value, match)) {
            continue
        }
        const index = match.index ?? 0
        if (index > last) {
            segments.push(value.slice(last, index))
        }
        segments.push(
            <mark key={index} className={markClass}>
                {showWhitespace(match[0])}
            </mark>
        )
        last = index + match[0].length
    }
    if (last < value.length) {
        segments.push(value.slice(last))
    }
    return (
        <span className={styles.value}>
            &quot;{segments}
            &quot;
        </span>
    )
}
