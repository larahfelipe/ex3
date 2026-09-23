import { useEffect, useRef, useState, type FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { ListedTransaction } from '@/app/api/v1/transactions';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_TONES
} from '@/common/constants';
import { formatExecutionTime, formatQuantity } from '@/common/utils';
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
      <Table label="Transactions table">
        <TableCaption className="sr-only">
          Transactions, newest first
        </TableCaption>

        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>

            <TableHead>Type</TableHead>

            {hasAssetColumn && <TableHead>Asset</TableHead>}

            <TableHead className="text-right max-sm:hidden">Quantity</TableHead>

            <TableHead className="text-right max-sm:hidden">
              Unit price
            </TableHead>

            <TableHead>
              <span className="sr-only">Details</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {transactions.map((transaction, index) => (
            <TableRow key={transaction.id}>
              <TableRowHeader className="sm:whitespace-nowrap">
                <time dateTime={transaction.executedAt}>
                  {formatExecutionTime(transaction.executedAt)}
                </time>
              </TableRowHeader>

              <TableCell className={TRANSACTION_TYPE_TONES[transaction.type]}>
                {TRANSACTION_TYPE_LABELS[transaction.type]}
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
                  Details
                  <span className="sr-only">
                    {` for ${TRANSACTION_TYPE_LABELS[transaction.type]} ${transaction.symbol} on ${formatExecutionTime(transaction.executedAt)}`}
                  </span>
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
          title="Delete this transaction?"
          description={`${TRANSACTION_TYPE_LABELS[selection.transaction.type]} of ${formatQuantity(selection.transaction.quantity)} ${selection.transaction.symbol} on ${formatExecutionTime(selection.transaction.executedAt)}. The position is recalculated without it, and this cannot be undone.`}
          confirmLabel="Delete transaction"
          failureMessage="The transaction could not be deleted"
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
