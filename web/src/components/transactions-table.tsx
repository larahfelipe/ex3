import { useState, type FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { ListedTransaction } from '@/app/api/v1/transactions';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_TONES
} from '@/common/constants';
import {
  formatExecutionTime,
  formatPrice,
  formatQuantity
} from '@/common/utils';
import { DeleteTransactionDialog } from '@/components/delete-transaction-dialog';
import { TransactionDetailsDialog } from '@/components/transaction-details-dialog';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
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

  const { mutateAsync: updateTransaction } = useUpdateTransaction(portfolio);
  const { mutateAsync: deleteTransaction } = useDeleteTransaction(portfolio);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>

            <TableHead>Type</TableHead>

            {hasAssetColumn && <TableHead>Asset</TableHead>}

            <TableHead className="text-right">Quantity</TableHead>

            <TableHead className="text-right">Unit price</TableHead>

            <TableHead>
              <span className="sr-only">Details</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="whitespace-nowrap">
                <time dateTime={transaction.executedAt}>
                  {formatExecutionTime(transaction.executedAt)}
                </time>
              </TableCell>

              <TableCell className={TRANSACTION_TYPE_TONES[transaction.type]}>
                {TRANSACTION_TYPE_LABELS[transaction.type]}
              </TableCell>

              {hasAssetColumn && (
                <TableCell className="font-medium">
                  {transaction.symbol}
                </TableCell>
              )}

              <TableCell className="text-right">
                {formatQuantity(transaction.quantity)}
              </TableCell>

              <TableCell className="text-right">
                {formatPrice(transaction.unitPrice, transaction.currency)}
              </TableCell>

              <TableCell className="text-right">
                <Button
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
        <DeleteTransactionDialog
          transaction={selection.transaction}
          onCancel={() => setSelection({ ...selection, action: 'details' })}
          onConfirm={async () => {
            await deleteTransaction({ id: selection.transaction.id });
            setSelection(null);
          }}
        />
      )}
    </>
  );
};
