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
import { FixError } from '@/types/metadata'

type Props = {
    fixedCount: number
    errors: FixError[]
    onClose: () => void
}

export const FixResultsModal = ({ fixedCount, errors, onClose }: Props) => (
    <Modal large onClose={onClose} dataTest="fix-results-modal">
        <ModalTitle>{i18n.t('Fix results')}</ModalTitle>
        <ModalContent>
            <p>
                {i18n.t(
                    '{{fixed}} object(s) fixed, {{failed}} object(s) failed.',
                    {
                        fixed: fixedCount,
                        failed: errors.length,
                    }
                )}
            </p>
            {errors.length > 0 && (
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
                                {i18n.t('Error message')}
                            </DataTableColumnHeader>
                        </DataTableRow>
                    </TableHead>
                    <TableBody>
                        {errors.map((error) => (
                            <DataTableRow key={error.id}>
                                <DataTableCell>{error.name}</DataTableCell>
                                <DataTableCell>{error.id}</DataTableCell>
                                <DataTableCell>{error.message}</DataTableCell>
                            </DataTableRow>
                        ))}
                    </TableBody>
                </DataTable>
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
