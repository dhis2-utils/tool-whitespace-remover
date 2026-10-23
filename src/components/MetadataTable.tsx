import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    Checkbox,
    DataTable,
    DataTableCell,
    DataTableColumnHeader,
    DataTableRow,
    NoticeBox,
    Pagination,
    TableBody,
    TableHead,
    Tag,
} from '@dhis2/ui'
import React, { useState } from 'react'
import styles from './MetadataTable.module.css'
import { WhitespaceHighlight } from './WhitespaceHighlight'
import type { CleanableField, MetadataItem, RowStatus } from '@/types/metadata'
import { isFixable, protectedFields } from '@/utils/whitespace'

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

// Why the tool leaves the protected fields of a type alone
const ProtectedNotice = ({ type }: { type: string }) => {
    if (type === 'options') {
        return (
            <NoticeBox warning title={i18n.t('Option codes are not changed')}>
                {i18n.t(
                    'Whitespace in option codes is highlighted in red. The tool does not remove it: data stores the option code, and program rules compare values against it, so a changed code would no longer match the stored values. Change the code by hand, together with the stored values.'
                )}
            </NoticeBox>
        )
    }
    if (type === 'programRuleVariables') {
        return (
            <NoticeBox
                warning
                title={i18n.t('Program rule variable names are not changed')}
            >
                {i18n.t(
                    'Whitespace in program rule variable names is highlighted in red. The tool does not remove it: program rules refer to a variable by its exact name, so a changed name would break them. Rename the variable by hand, together with the program rules that use it.'
                )}
            </NoticeBox>
        )
    }
    return null
}

interface RowProps {
    item: MetadataItem
    type: string
    status: RowStatus
    selected: boolean
    busy: boolean
    onToggle: (id: string, checked: boolean) => void
    onCheck: (item: MetadataItem) => void
    onFix: (item: MetadataItem) => void
}

const FIELDS: CleanableField[] = ['name', 'shortName', 'code', 'description']

const MetadataRow = ({
    item,
    type,
    status,
    selected,
    busy,
    onToggle,
    onCheck,
    onFix,
}: RowProps) => {
    const fixable = isFixable(item, type)
    const isProtected = protectedFields(type)
    return (
        <DataTableRow dataTest="metadata-row">
            <DataTableCell>
                <Checkbox
                    dataTest="row-checkbox"
                    checked={selected}
                    disabled={busy || !fixable}
                    onChange={({ checked }) =>
                        onToggle(item.id, checked === true)
                    }
                />
            </DataTableCell>
            <DataTableCell>{item.id}</DataTableCell>
            {FIELDS.map((field) => (
                <DataTableCell key={field}>
                    <WhitespaceHighlight
                        value={item[field]}
                        isProtected={isProtected.includes(field)}
                    />
                </DataTableCell>
            ))}
            <DataTableCell>
                {fixable && (
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
                            onClick={() => onCheck(item)}
                        >
                            {i18n.t('Check')}
                        </Button>
                        <Button
                            small
                            primary
                            dataTest="fix-button"
                            disabled={busy || status !== 'ready'}
                            onClick={() => onFix(item)}
                        >
                            {i18n.t('Fix')}
                        </Button>
                    </ButtonStrip>
                )}
            </DataTableCell>
            <DataTableCell dataTest="status-cell">
                {fixable ? (
                    <StatusTag status={status} />
                ) : (
                    <Tag>{i18n.t('Fix manually')}</Tag>
                )}
            </DataTableCell>
        </DataTableRow>
    )
}

const DEFAULT_PAGE_SIZE = 50

interface Props {
    items: MetadataItem[]
    type: string
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
    type,
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

    // rows with only protected issues can never be selected
    const selectable = items.filter((item) => isFixable(item, type))
    const pageSelectable = pageItems.filter((item) => isFixable(item, type))
    const selectedItems = selectable.filter((item) => selected.has(item.id))
    const allPageSelected =
        pageSelectable.length > 0 &&
        pageSelectable.every((item) => selected.has(item.id))
    const somePageSelected = pageSelectable.some((item) =>
        selected.has(item.id)
    )
    const canFixSelected =
        selectedItems.length > 0 &&
        selectedItems.every((item) => statuses[item.id] === 'ready')

    return (
        <div className={styles.container}>
            <ProtectedNotice type={type} />
            <DataTable dataTest="metadata-table">
                <TableHead>
                    <DataTableRow>
                        <DataTableColumnHeader width="48px">
                            <Checkbox
                                dataTest="select-all"
                                disabled={busy || pageSelectable.length === 0}
                                checked={allPageSelected}
                                indeterminate={
                                    somePageSelected && !allPageSelected
                                }
                                onChange={({ checked }) =>
                                    onToggleAll(
                                        pageSelectable.map((item) => item.id),
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
                    {pageItems.map((item) => (
                        <MetadataRow
                            key={item.id}
                            item={item}
                            type={type}
                            status={statuses[item.id] ?? 'unchecked'}
                            selected={selected.has(item.id)}
                            busy={busy}
                            onToggle={onToggle}
                            onCheck={onCheckOne}
                            onFix={onFixOne}
                        />
                    ))}
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
                        total: selectable.length,
                    })}
                </span>
                {selectable.length > pageSelectable.length &&
                    selectedItems.length < selectable.length && (
                        <Button
                            small
                            secondary
                            dataTest="select-all-pages"
                            disabled={busy}
                            onClick={() =>
                                onToggleAll(
                                    selectable.map((item) => item.id),
                                    true
                                )
                            }
                        >
                            {i18n.t('Select all {{total}} across all pages', {
                                total: selectable.length,
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
