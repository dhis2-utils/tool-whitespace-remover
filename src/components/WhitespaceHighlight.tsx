import type { ReactNode } from 'react'
import React from 'react'
import styles from './WhitespaceHighlight.module.css'

const WHITESPACE_RUN = /\s+/g

// A whitespace run is problematic if it is leading, trailing, or repeated
const isProblemRun = (value: string, index: number, run: string): boolean =>
    index === 0 || index + run.length === value.length || run.length >= 2

/**
 * Renders a metadata value in quotes, with the problematic whitespace
 * (leading, trailing, repeated) highlighted: yellow for whitespace the tool
 * removes, red for whitespace in a field it never changes.
 */
export const WhitespaceHighlight = ({
    value,
    isProtected = false,
}: {
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
        const index = match.index ?? 0
        if (!isProblemRun(value, index, match[0])) {
            continue
        }
        if (index > last) {
            segments.push(value.slice(last, index))
        }
        segments.push(
            <mark key={index} className={markClass}>
                {match[0]}
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
