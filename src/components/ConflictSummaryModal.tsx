import i18n from '@dhis2/d2-i18n'
import {
    Button,
    ButtonStrip,
    DataTable,
    DataTableCell,
    DataTableColumnHeader,
    DataTableRow,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    TableBody,
    TableHead,
} from '@dhis2/ui'
import React from 'react'
import { Conflict } from '@/types/metadata'

type Props = {
    conflicts: Conflict[]
    checkedCount: number
    errorCount: number
    onClose: () => void
}

export const ConflictSummaryModal = ({
    conflicts,
    checkedCount,
    errorCount,
    onClose,
}: Props) => {
    const conflictingIds = new Set(conflicts.map((c) => c.objectId))
    return (
        <Modal large onClose={onClose} dataTest="conflict-summary-modal">
            <ModalTitle>{i18n.t('Conflict check summary')}</ModalTitle>
            <ModalContent>
                <p>
                    {i18n.t(
                        '{{ok}} object(s) did not have any conflicts, {{bad}} object(s) had one or more conflicts.',
                        {
                            ok: checkedCount - conflictingIds.size - errorCount,
                            bad: conflictingIds.size,
                        }
                    )}
                </p>
                {errorCount > 0 && (
                    <p>
                        {i18n.t(
                            'The check failed for {{failed}} object(s); these are not included in the counts above.',
                            { failed: errorCount }
                        )}
                    </p>
                )}
                {conflicts.length > 0 && (
                    <>
                        <p>
                            {i18n.t(
                                'Removing whitespace from the objects below would create duplicate names, short names or codes. These objects must be fixed manually.'
                            )}
                        </p>
                        <DataTable>
                            <TableHead>
                                <DataTableRow>
                                    <DataTableColumnHeader>
                                        {i18n.t('Object name')}
                                    </DataTableColumnHeader>
                                    <DataTableColumnHeader>
                                        {i18n.t('Object ID')}
                                    </DataTableColumnHeader>
                                    <DataTableColumnHeader>
                                        {i18n.t('Conflicting property')}
                                    </DataTableColumnHeader>
                                    <DataTableColumnHeader>
                                        {i18n.t('Conflicting object ID')}
                                    </DataTableColumnHeader>
                                </DataTableRow>
                            </TableHead>
                            <TableBody>
                                {conflicts.map((conflict, index) => (
                                    <DataTableRow
                                        key={`${conflict.objectId}-${index}`}
                                    >
                                        <DataTableCell>
                                            {conflict.objectName}
                                        </DataTableCell>
                                        <DataTableCell>
                                            {conflict.objectId}
                                        </DataTableCell>
                                        <DataTableCell>
                                            {conflict.property}
                                        </DataTableCell>
                                        <DataTableCell>
                                            {conflict.conflictingObjectId}
                                        </DataTableCell>
                                    </DataTableRow>
                                ))}
                            </TableBody>
                        </DataTable>
                    </>
                )}
            </ModalContent>
            <ModalActions>
                <ButtonStrip end>
                    <Button primary onClick={onClose}>
                        {i18n.t('Close')}
                    </Button>
                </ButtonStrip>
            </ModalActions>
        </Modal>
    )
}
