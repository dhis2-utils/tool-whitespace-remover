import { useAlert, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { LinearLoader, NoticeBox, Tab, TabBar } from '@dhis2/ui'
import React, { useEffect, useState } from 'react'
import styles from './CleanerPage.module.css'
import { ConflictSummaryModal } from './ConflictSummaryModal'
import { FixResultsModal } from './FixResultsModal'
import { MetadataTable } from './MetadataTable'
import { findConflicts } from '@/api/conflicts'
import { fixItems } from '@/api/fixes'
import { useWhitespaceScan } from '@/hooks/useWhitespaceScan'
import {
    Conflict,
    FixError,
    MetadataItem,
    MetadataMap,
    RowStatus,
} from '@/types/metadata'
import { chunk } from '@/utils/chunk'

const BATCH_SIZE = 20

const typeLabel = (type: string): string => {
    const spaced = type.replace(/([A-Z])/g, ' $1').toLowerCase()
    return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

type ConflictModalState = {
    conflicts: Conflict[]
    checkedCount: number
    errorCount: number
}
type ResultsModalState = { fixedCount: number; errors: FixError[] }

export const CleanerPage = () => {
    const engine = useDataEngine()
    const { data, isLoading, error, progress } = useWhitespaceScan()

    const [items, setItems] = useState<MetadataMap>({})
    const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [activeTab, setActiveTab] = useState<string>()
    const [busy, setBusy] = useState(false)
    const [conflictModal, setConflictModal] =
        useState<ConflictModalState | null>(null)
    const [resultsModal, setResultsModal] = useState<ResultsModalState | null>(
        null
    )

    const { show: showSuccess } = useAlert(({ message }) => String(message), {
        success: true,
        duration: 3000,
    })
    const { show: showError } = useAlert(({ message }) => String(message), {
        critical: true,
    })

    useEffect(() => {
        if (data) {
            setItems(data)
            setStatuses({})
            setSelected(new Set())
        }
    }, [data])

    const types = Object.keys(items).sort((a, b) => a.localeCompare(b))
    const activeType =
        activeTab && types.includes(activeTab) ? activeTab : types[0]
    const activeItems = activeType ? items[activeType] : []

    const setStatus = (ids: string[], status: RowStatus) =>
        setStatuses((previous) => {
            const next = { ...previous }
            for (const id of ids) {
                next[id] = status
            }
            return next
        })

    const setSelection = (ids: string[], isSelected: boolean) =>
        setSelected((previous) => {
            const next = new Set(previous)
            for (const id of ids) {
                if (isSelected) {
                    next.add(id)
                } else {
                    next.delete(id)
                }
            }
            return next
        })

    const removeItems = (type: string, ids: string[]) => {
        const removed = new Set(ids)
        setItems((previous) => {
            const remaining = (previous[type] ?? []).filter(
                (item) => !removed.has(item.id)
            )
            const next = { ...previous }
            if (remaining.length === 0) {
                delete next[type]
            } else {
                next[type] = remaining
            }
            return next
        })
        setSelection(ids, false)
        setStatuses((previous) => {
            const next = { ...previous }
            for (const id of ids) {
                delete next[id]
            }
            return next
        })
    }

    // Check a batch of items for conflicts; peers are compared against each
    // other as well as against the server. Returns all conflicts found.
    const checkItems = async (
        type: string,
        itemsToCheck: MetadataItem[],
        peers: MetadataItem[]
    ): Promise<{ conflicts: Conflict[]; errorCount: number }> => {
        const allConflicts: Conflict[] = []
        let errorCount = 0
        setStatus(
            itemsToCheck.map((item) => item.id),
            'checking'
        )
        for (const batch of chunk(itemsToCheck, BATCH_SIZE)) {
            await Promise.all(
                batch.map(async (item) => {
                    try {
                        const conflicts = await findConflicts({
                            engine,
                            type,
                            item,
                            peers,
                        })
                        if (conflicts.length > 0) {
                            allConflicts.push(...conflicts)
                            setStatus([item.id], 'conflict')
                            setSelection([item.id], false)
                        } else {
                            setStatus([item.id], 'ready')
                            setSelection([item.id], true)
                        }
                    } catch (checkError) {
                        errorCount += 1
                        setStatus([item.id], 'error')
                        setSelection([item.id], false)
                        console.error(
                            'Conflict check failed for',
                            item.id,
                            checkError
                        )
                    }
                })
            )
        }
        return { conflicts: allConflicts, errorCount }
    }

    const handleCheckOne = async (item: MetadataItem) => {
        if (!activeType) {
            return
        }
        const { conflicts, errorCount } = await checkItems(
            activeType,
            [item],
            []
        )
        if (errorCount > 0) {
            showError({ message: i18n.t('Conflict check failed') })
        } else if (conflicts.length > 0) {
            setConflictModal({ conflicts, checkedCount: 1, errorCount: 0 })
        } else {
            showSuccess({ message: i18n.t('No conflicts found') })
        }
    }

    const handleCheckSelected = async () => {
        if (!activeType) {
            return
        }
        const toCheck = activeItems.filter((item) => selected.has(item.id))
        setBusy(true)
        try {
            const { conflicts, errorCount } = await checkItems(
                activeType,
                toCheck,
                toCheck
            )
            setConflictModal({
                conflicts,
                checkedCount: toCheck.length,
                errorCount,
            })
            if (errorCount > 0) {
                showError({
                    message: i18n.t(
                        'Conflict check failed for {{count}} object(s)',
                        { count: errorCount }
                    ),
                })
            }
        } finally {
            setBusy(false)
        }
    }

    const applyFix = async (type: string, toFix: MetadataItem[]) => {
        setBusy(true)
        setStatus(
            toFix.map((item) => item.id),
            'fixing'
        )
        try {
            const fixedIds: string[] = []
            const errors: FixError[] = []
            for (const batch of chunk(toFix, BATCH_SIZE)) {
                const result = await fixItems(engine, type, batch)
                fixedIds.push(...result.fixedIds)
                errors.push(...result.errors)
            }
            if (fixedIds.length > 0) {
                removeItems(type, fixedIds)
            }
            if (errors.length > 0) {
                setStatus(
                    errors.map((fixError) => fixError.id),
                    'error'
                )
                setSelection(
                    errors.map((fixError) => fixError.id),
                    false
                )
                setResultsModal({ fixedCount: fixedIds.length, errors })
            } else if (toFix.length === 1) {
                showSuccess({ message: i18n.t('Object fixed successfully') })
            } else {
                setResultsModal({ fixedCount: fixedIds.length, errors })
            }
        } finally {
            setBusy(false)
        }
    }

    const handleFixOne = (item: MetadataItem) => {
        if (activeType) {
            applyFix(activeType, [item])
        }
    }

    const handleFixSelected = () => {
        if (!activeType) {
            return
        }
        const toFix = activeItems.filter(
            (item) => selected.has(item.id) && statuses[item.id] === 'ready'
        )
        applyFix(activeType, toFix)
    }

    if (isLoading) {
        return (
            <div className={styles.page}>
                <p>{i18n.t('Scanning metadata for whitespace issues…')}</p>
                <LinearLoader amount={progress * 100} width="100%" />
            </div>
        )
    }

    if (error) {
        return (
            <div className={styles.page}>
                <NoticeBox error title={i18n.t('Error loading metadata')}>
                    {error.message}
                </NoticeBox>
            </div>
        )
    }

    if (types.length === 0) {
        return (
            <div className={styles.page}>
                <NoticeBox valid title={i18n.t('No whitespace issues found')}>
                    {i18n.t(
                        'No metadata with leading, trailing or double whitespace in names, codes or descriptions was found.'
                    )}
                </NoticeBox>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <TabBar scrollable>
                {types.map((type) => (
                    <Tab
                        key={type}
                        selected={type === activeType}
                        onClick={() => setActiveTab(type)}
                    >
                        {`${typeLabel(type)} (${items[type].length})`}
                    </Tab>
                ))}
            </TabBar>
            {activeType && (
                <MetadataTable
                    key={activeType}
                    items={activeItems}
                    statuses={statuses}
                    selected={selected}
                    busy={busy}
                    onToggle={(id, checked) => setSelection([id], checked)}
                    onToggleAll={(ids, checked) => setSelection(ids, checked)}
                    onCheckOne={handleCheckOne}
                    onFixOne={handleFixOne}
                    onCheckSelected={handleCheckSelected}
                    onFixSelected={handleFixSelected}
                />
            )}
            {conflictModal && (
                <ConflictSummaryModal
                    conflicts={conflictModal.conflicts}
                    checkedCount={conflictModal.checkedCount}
                    errorCount={conflictModal.errorCount}
                    onClose={() => setConflictModal(null)}
                />
            )}
            {resultsModal && (
                <FixResultsModal
                    fixedCount={resultsModal.fixedCount}
                    errors={resultsModal.errors}
                    onClose={() => setResultsModal(null)}
                />
            )}
        </div>
    )
}
