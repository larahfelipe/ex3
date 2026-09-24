import type { FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { EmptyState, LoadingState } from '@/components/data-state';
import { PageNavigation } from '@/components/page-navigation';
import { QuerySection } from '@/components/query-section';
import { TransactionsTable } from '@/components/transactions-table';
import { usePageParam } from '@/hooks/use-page-param';
import { useTransactions } from '@/hooks/use-transactions';
import { FIRST_PAGE } from '@/lib/pagination';

type AssetTransactionsProps = Record<'portfolio', Portfolio> &
  Record<'symbol', string>;

const TRANSACTIONS_PAGE_SIZE = 10;
const TRANSACTIONS_PAGE_PARAM = 'transactionsPage';

export const AssetTransactions: FC<AssetTransactionsProps> = ({
  portfolio,
  symbol
}) => {
  const [requestedPage, goToPage] = usePageParam(TRANSACTIONS_PAGE_PARAM);

  const transactionsQuery = useTransactions(portfolio, {
    symbol,
    page: requestedPage,
    pageSize: TRANSACTIONS_PAGE_SIZE
  });

  return (
    <QuerySection
      title="Transactions"
      query={transactionsQuery}
      errorMessage="The transactions could not be loaded"
      loading={<LoadingState label="Loading transactions" />}
      isEmpty={({ total }) => total === 0}
      empty={<EmptyState message="No transactions for this asset" />}
    >
      {({ items, page, totalPages }) =>
        items.length === 0 ? (
          <EmptyState
            message={`No transactions on page ${page}`}
            action={{
              label: `Go to page ${totalPages}`,
              onSelect: () => goToPage(totalPages)
            }}
          />
        ) : (
          <div className="space-y-4">
            <TransactionsTable
              portfolio={portfolio}
              transactions={items}
              hasAssetColumn={false}
            />

            {totalPages > FIRST_PAGE && (
              <PageNavigation
                label="Transactions pages"
                page={page}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            )}
          </div>
        )
      }
    </QuerySection>
  );
};
