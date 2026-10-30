import type { FC } from 'react';

import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import type { TransactionFilters } from '@/app/api/v1/transactions';
import { EmptyState, LoadingState } from '@/components/data-state';
import { QuerySection } from '@/components/query-section';
import { TransactionsTable } from '@/components/transactions-table';
import { useTransactions } from '@/hooks/use-transactions';

type RecentTransactionsProps = Record<'portfolio', Portfolio>;

/** Also read by the overview to tell whether the portfolio has any transaction, from the same cached page. */
export const RECENT_TRANSACTIONS_PAGE: TransactionFilters = {
  page: 1,
  pageSize: 5
};

export const RecentTransactions: FC<RecentTransactionsProps> = ({
  portfolio
}) => {
  const transactionsQuery = useTransactions(
    portfolio,
    RECENT_TRANSACTIONS_PAGE
  );
  const t = useTranslations('investments.overview.recentTransactions');

  return (
    <QuerySection
      title={t('title')}
      query={transactionsQuery}
      errorMessage={t('loadFailed')}
      loading={<LoadingState label={t('loading')} />}
      isEmpty={({ total }) => total === 0}
      empty={<EmptyState message={t('empty')} />}
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
