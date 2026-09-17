import { useState, type FC } from 'react';

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
import { TransactionDetailsDialog } from '@/components/transaction-details-dialog';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';

type TransactionsTableProps = Record<
  'transactions',
  ReadonlyArray<ListedTransaction>
> &
  Record<'hasAssetColumn', boolean>;

export const TransactionsTable: FC<TransactionsTableProps> = ({
  transactions,
  hasAssetColumn
}) => {
  const [selectedTransaction, setSelectedTransaction] =
    useState<ListedTransaction | null>(null);

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
                  onClick={() => setSelectedTransaction(transaction)}
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
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  );
};
