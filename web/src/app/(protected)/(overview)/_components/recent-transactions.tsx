import type { FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { TransactionFilters } from '@/app/api/v1/transactions';
import { EmptyState, LoadingState } from '@/components/data-state';
import { QuerySection } from '@/components/query-section';
import { TransactionsTable } from '@/components/transactions-table';
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
      loading={<LoadingState label="Loading recent transactions" />}
      isEmpty={({ total }) => total === 0}
      empty={<EmptyState message="No transactions yet" />}
    >
      {({ items }) => (
        <TransactionsTable
          portfolio={portfolio}
          transactions={items}
          hasAssetColumn
        />
      )}
    </QuerySection>
  );
};
