import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    Checkbox,
    DataTable,
    DataTableCell,
    DataTableColumnHeader,
    DataTableRow,
    Pagination,
    TableBody,
    TableHead,
    Tag,
} from '@dhis2/ui'
import React, { useState } from 'react'
import styles from './MetadataTable.module.css'
import { WhitespaceHighlight } from './WhitespaceHighlight'
import { MetadataItem, RowStatus } from '@/types/metadata'

const StatusTag = ({ status }: { status: RowStatus }) => {
    switch (status) {
        case 'checking':
            return <Tag neutral>{i18n.t('Checking…')}</Tag>
        case 'ready':
            return <Tag positive>{i18n.t('Ready')}</Tag>
        case 'conflict':
            return <Tag negative>{i18n.t('Conflict')}</Tag>
        case 'fixing':
            return <Tag neutral>{i18n.t('Fixing…')}</Tag>
        case 'error':
            return <Tag negative>{i18n.t('Error')}</Tag>
        default:
            return null
    }
}

const DEFAULT_PAGE_SIZE = 50

type Props = {
    items: MetadataItem[]
    statuses: Record<string, RowStatus>
    selected: Set<string>
    busy: boolean
    onToggle: (id: string, checked: boolean) => void
    onToggleAll: (ids: string[], checked: boolean) => void
    onCheckOne: (item: MetadataItem) => void
    onFixOne: (item: MetadataItem) => void
    onCheckSelected: () => void
    onFixSelected: () => void
}

export const MetadataTable = ({
    items,
    statuses,
    selected,
    busy,
    onToggle,
    onToggleAll,
    onCheckOne,
    onFixOne,
    onCheckSelected,
    onFixSelected,
}: Props) => {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

    // items shrink as rows get fixed - keep the page in range
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
    const currentPage = Math.min(page, pageCount)
    const pageItems = items.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    )

    const selectedItems = items.filter((item) => selected.has(item.id))
    const allPageSelected =
        pageItems.length > 0 && pageItems.every((item) => selected.has(item.id))
    const somePageSelected = pageItems.some((item) => selected.has(item.id))
    const canFixSelected =
        selectedItems.length > 0 &&
        selectedItems.every((item) => statuses[item.id] === 'ready')

    return (
        <div className={styles.container}>
            <DataTable dataTest="metadata-table">
                <TableHead>
                    <DataTableRow>
                        <DataTableColumnHeader width="48px">
                            <Checkbox
                                dataTest="select-all"
                                disabled={busy}
                                checked={allPageSelected}
                                indeterminate={
                                    somePageSelected && !allPageSelected
                                }
                                onChange={({ checked }) =>
                                    onToggleAll(
                                        pageItems.map((item) => item.id),
                                        checked === true
                                    )
                                }
                            />
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('ID')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Name')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Short name')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Code')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Description')}
                        </DataTableColumnHeader>
                        <DataTableColumnHeader>
                            {i18n.t('Actions')}
                        </DataTableColumnHeader>
                        {/* fixed width so the tag appearing doesn't reflow
                            the other columns */}
                        <DataTableColumnHeader width="110px">
                            {i18n.t('Status')}
                        </DataTableColumnHeader>
                    </DataTableRow>
                </TableHead>
                <TableBody>
                    {pageItems.map((item) => {
                        const status = statuses[item.id] ?? 'unchecked'
                        return (
                            <DataTableRow key={item.id} dataTest="metadata-row">
                                <DataTableCell>
                                    <Checkbox
                                        dataTest="row-checkbox"
                                        checked={selected.has(item.id)}
                                        disabled={busy}
                                        onChange={({ checked }) =>
                                            onToggle(item.id, checked === true)
                                        }
                                    />
                                </DataTableCell>
                                <DataTableCell>{item.id}</DataTableCell>
                                <DataTableCell>
                                    <WhitespaceHighlight value={item.name} />
                                </DataTableCell>
                                <DataTableCell>
                                    <WhitespaceHighlight
                                        value={item.shortName}
                                    />
                                </DataTableCell>
                                <DataTableCell>
                                    <WhitespaceHighlight value={item.code} />
                                </DataTableCell>
                                <DataTableCell>
                                    <WhitespaceHighlight
                                        value={item.description}
                                    />
                                </DataTableCell>
                                <DataTableCell>
                                    <ButtonStrip>
                                        <Button
                                            small
                                            secondary
                                            dataTest="check-button"
                                            disabled={
                                                busy ||
                                                status === 'checking' ||
                                                status === 'fixing'
                                            }
                                            onClick={() => onCheckOne(item)}
                                        >
                                            {i18n.t('Check')}
                                        </Button>
                                        <Button
                                            small
                                            primary
                                            dataTest="fix-button"
                                            disabled={
                                                busy || status !== 'ready'
                                            }
                                            onClick={() => onFixOne(item)}
                                        >
                                            {i18n.t('Fix')}
                                        </Button>
                                    </ButtonStrip>
                                </DataTableCell>
                                <DataTableCell dataTest="status-cell">
                                    <StatusTag status={status} />
                                </DataTableCell>
                            </DataTableRow>
                        )
                    })}
                </TableBody>
            </DataTable>
            <div className={styles.pagination}>
                <Pagination
                    page={currentPage}
                    pageSize={pageSize}
                    pageCount={pageCount}
                    total={items.length}
                    pageSizes={['25', '50', '100']}
                    disabled={busy}
                    onPageChange={(newPage: number) => setPage(newPage)}
                    onPageSizeChange={(newSize: string | number) => {
                        setPageSize(Number(newSize))
                        setPage(1)
                    }}
                />
            </div>
            <div className={styles.selectionBar} data-test="selection-summary">
                <span className={styles.selectionCount}>
                    {i18n.t('{{selected}} of {{total}} objects selected', {
                        selected: selectedItems.length,
                        total: items.length,
                    })}
                </span>
                {items.length > pageItems.length &&
                    selectedItems.length < items.length && (
                        <Button
                            small
                            secondary
                            dataTest="select-all-pages"
                            disabled={busy}
                            onClick={() =>
                                onToggleAll(
                                    items.map((item) => item.id),
                                    true
                                )
                            }
                        >
                            {i18n.t('Select all {{total}} across all pages', {
                                total: items.length,
                            })}
                        </Button>
                    )}
                {selectedItems.length > 0 && (
                    <Button
                        small
                        secondary
                        dataTest="clear-selection"
                        disabled={busy}
                        onClick={() =>
                            onToggleAll(
                                items.map((item) => item.id),
                                false
                            )
                        }
                    >
                        {i18n.t('Clear selection')}
                    </Button>
                )}
            </div>
            <div className={styles.footer}>
                <ButtonStrip>
                    <Button
                        secondary
                        dataTest="check-selected"
                        disabled={busy || selectedItems.length === 0}
                        onClick={onCheckSelected}
                    >
                        {selectedItems.length > 0
                            ? i18n.t('Check selected ({{n}})', {
                                  n: selectedItems.length,
                              })
                            : i18n.t('Check selected')}
                    </Button>
                    <Button
                        primary
                        dataTest="fix-selected"
                        disabled={busy || !canFixSelected}
                        onClick={onFixSelected}
                    >
                        {selectedItems.length > 0 && canFixSelected
                            ? i18n.t('Fix selected ({{n}})', {
                                  n: selectedItems.length,
                              })
                            : i18n.t('Fix selected')}
                    </Button>
                </ButtonStrip>
            </div>
        </div>
    )
}
