import type { FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { TransactionFilters } from '@/app/api/v1/transactions';
import { QuerySection } from '@/components/query-section';
import { TransactionsTable } from '@/components/transactions-table';
import { Skeleton } from '@/components/ui';
import { useTransactions } from '@/hooks/use-transactions';

type RecentTransactionsProps = Record<'portfolio', Portfolio>;

const RECENT_TRANSACTIONS_PAGE: TransactionFilters = { page: 1, pageSize: 5 };

export const RecentTransactions: FC<RecentTransactionsProps> = ({
  portfolio
}) => {
  const transactionsQuery = useTransactions(
    portfolio,
    RECENT_TRANSACTIONS_PAGE
  );

  return (
    <QuerySection
      title="Recent transactions"
      query={transactionsQuery}
      errorMessage="The recent transactions could not be loaded"
      loading={<Skeleton className="h-40 w-full" />}
      isEmpty={({ total }) => total === 0}
      empty={
        <p className="text-sm text-muted-foreground">No transactions yet</p>
      }
    >
      {({ items }) => <TransactionsTable transactions={items} hasAssetColumn />}
    </QuerySection>
  );
};
