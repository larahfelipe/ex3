import { useState, type FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  ListedTransaction,
  TransactionFilters
} from '@/app/api/v1/transactions';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_TONES
} from '@/common/constants';
import {
  formatExecutionTime,
  formatPrice,
  formatQuantity
} from '@/common/utils';
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import { useTransactions } from '@/hooks/use-transactions';

import { OverviewSection } from './overview-section';
import { TransactionDetailsDialog } from './transaction-details-dialog';

type RecentTransactionsProps = Record<'portfolio', Portfolio>;

const RECENT_TRANSACTIONS_PAGE: TransactionFilters = { page: 1, pageSize: 5 };

export const RecentTransactions: FC<RecentTransactionsProps> = ({
  portfolio
}) => {
  const transactionsQuery = useTransactions(
    portfolio,
    RECENT_TRANSACTIONS_PAGE
  );
  const [selectedTransaction, setSelectedTransaction] =
    useState<ListedTransaction | null>(null);

  return (
    <>
      <OverviewSection
        title="Recent transactions"
        query={transactionsQuery}
        errorMessage="The recent transactions could not be loaded"
        loading={<Skeleton className="h-40 w-full" />}
        isEmpty={({ total }) => total === 0}
        empty={
          <p className="text-sm text-muted-foreground">No transactions yet</p>
        }
      >
        {({ items }) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>

                <TableHead>Type</TableHead>

                <TableHead>Asset</TableHead>

                <TableHead className="text-right">Quantity</TableHead>

                <TableHead className="text-right">Unit price</TableHead>

                <TableHead>
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    <time dateTime={transaction.executedAt}>
                      {formatExecutionTime(transaction.executedAt)}
                    </time>
                  </TableCell>

                  <TableCell
                    className={TRANSACTION_TYPE_TONES[transaction.type]}
                  >
                    {TRANSACTION_TYPE_LABELS[transaction.type]}
                  </TableCell>

                  <TableCell className="font-medium">
                    {transaction.symbol}
                  </TableCell>

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
        )}
      </OverviewSection>

      <TransactionDetailsDialog
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  );
};
