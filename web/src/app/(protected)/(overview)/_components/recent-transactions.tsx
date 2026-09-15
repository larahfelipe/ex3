import type { FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  TransactionFilters,
  TransactionType
} from '@/app/api/v1/transactions';
import { formatPrice, formatQuantity } from '@/common/utils';
import {
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

type RecentTransactionsProps = Record<'portfolio', Portfolio>;

const RECENT_TRANSACTIONS_PAGE: TransactionFilters = { page: 1, pageSize: 5 };

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUY: 'Buy',
  SELL: 'Sell'
};

const TRANSACTION_TYPE_TONES: Record<TransactionType, string> = {
  BUY: 'text-green-600',
  SELL: 'text-red-600'
};

const EXECUTION_TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

export const RecentTransactions: FC<RecentTransactionsProps> = ({
  portfolio
}) => {
  const transactionsQuery = useTransactions(
    portfolio,
    RECENT_TRANSACTIONS_PAGE
  );

  return (
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
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="whitespace-nowrap">
                  <time dateTime={transaction.executedAt}>
                    {EXECUTION_TIME_FORMAT.format(
                      new Date(transaction.executedAt)
                    )}
                  </time>
                </TableCell>

                <TableCell className={TRANSACTION_TYPE_TONES[transaction.type]}>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </OverviewSection>
  );
};
