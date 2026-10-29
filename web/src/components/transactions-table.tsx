import { useEffect, useRef, useState, type FC } from 'react';

import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { ListedTransaction } from '@/app/api/v1/transactions';
import { TRANSACTION_TYPE_TONES } from '@/common/constants';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { Price, Quantity } from '@/components/financial';
import { TransactionDetailsDialog } from '@/components/transaction-details-dialog';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import {
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import {
  useDeleteTransaction,
  useUpdateTransaction
} from '@/hooks/use-transactions';
import { useFormat } from '@/i18n/format';

type TransactionsTableProps = Record<'portfolio', Portfolio> &
  Record<'transactions', ReadonlyArray<ListedTransaction>> &
  Record<'hasAssetColumn', boolean>;

type TransactionSelection = {
  transaction: ListedTransaction;
  action: 'details' | 'edit' | 'delete';
};

export const TransactionsTable: FC<TransactionsTableProps> = ({
  portfolio,
  transactions,
  hasAssetColumn
}) => {
  const t = useTranslations('transactions');
  const { formatExecutionDay, formatQuantity } = useFormat();
  const [selection, setSelection] = useState<TransactionSelection | null>(null);
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const firstDetailsRef = useRef<HTMLButtonElement>(null);

  const { mutateAsync: updateTransaction } = useUpdateTransaction(portfolio);
  const { mutateAsync: deleteTransaction } = useDeleteTransaction(portfolio);

  useEffect(() => {
    if (deletedId === null) return;
    if (transactions.some(({ id }) => id === deletedId)) return;

    setDeletedId(null);
    firstDetailsRef.current?.focus();
  }, [deletedId, transactions]);

  return (
    <>
      <Table label={t('table.label')}>
        <TableCaption className="sr-only">{t('table.caption')}</TableCaption>

        <TableHeader>
          <TableRow>
            <TableHead>{t('fields.date')}</TableHead>

            <TableHead>{t('fields.type')}</TableHead>

            {hasAssetColumn && <TableHead>{t('fields.asset')}</TableHead>}

            <TableHead className="text-right max-sm:hidden">
              {t('fields.quantity')}
            </TableHead>

            <TableHead className="text-right max-sm:hidden">
              {t('fields.unitPrice')}
            </TableHead>

            <TableHead>
              <span className="sr-only">{t('table.details')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {transactions.map((transaction, index) => (
            <TableRow key={transaction.id}>
              <TableRowHeader className="sm:whitespace-nowrap">
                <time dateTime={transaction.executedAt}>
                  {formatExecutionDay(transaction.executedAt)}
                </time>
              </TableRowHeader>

              <TableCell className={TRANSACTION_TYPE_TONES[transaction.type]}>
                {t(`types.${transaction.type}`)}
              </TableCell>

              {hasAssetColumn && (
                <TableCell className="font-medium">
                  {transaction.symbol}
                </TableCell>
              )}

              <TableCell className="text-right max-sm:hidden">
                <Quantity value={transaction.quantity} />
              </TableCell>

              <TableCell className="text-right max-sm:hidden">
                <Price
                  exact
                  value={transaction.unitPrice}
                  currency={transaction.currency}
                />
              </TableCell>

              <TableCell className="text-right">
                <Button
                  ref={index === 0 ? firstDetailsRef : null}
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() =>
                    setSelection({ transaction, action: 'details' })
                  }
                >
                  {t.rich('table.detailsOf', {
                    type: t(`types.${transaction.type}`),
                    symbol: transaction.symbol,
                    date: formatExecutionDay(transaction.executedAt),
                    hidden: (chunks) => (
                      <span className="sr-only">{chunks}</span>
                    )
                  })}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TransactionDetailsDialog
        transaction={selection?.transaction ?? null}
        onClose={() => setSelection(null)}
        onEdit={(transaction) => setSelection({ transaction, action: 'edit' })}
        onDelete={(transaction) =>
          setSelection({ transaction, action: 'delete' })
        }
      />

      {selection?.action === 'edit' && (
        <TransactionFormDialog
          portfolio={portfolio}
          target={{ kind: 'edit', transaction: selection.transaction }}
          onCancel={() => setSelection({ ...selection, action: 'details' })}
          onSubmit={async (draft) => {
            await updateTransaction({
              ...draft,
              id: selection.transaction.id,
              currency: selection.transaction.currency
            });
            setSelection(null);
          }}
        />
      )}

      {selection?.action === 'delete' && (
        <ConfirmDeletionDialog
          title={t('deletion.title')}
          description={t('deletion.description', {
            type: t(`types.${selection.transaction.type}`),
            quantity: formatQuantity(selection.transaction.quantity),
            symbol: selection.transaction.symbol,
            date: formatExecutionDay(selection.transaction.executedAt)
          })}
          confirmLabel={t('deletion.confirm')}
          failureMessage={t('deletion.failed')}
          onCancel={() => setSelection({ ...selection, action: 'details' })}
          onConfirm={async () => {
            await deleteTransaction({ id: selection.transaction.id });
            setDeletedId(selection.transaction.id);
            setSelection(null);
          }}
        />
      )}
    </>
  );
};
