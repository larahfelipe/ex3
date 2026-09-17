import { useState, type FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { QuerySection } from '@/components/query-section';
import { TransactionsTable } from '@/components/transactions-table';
import { Button, Skeleton } from '@/components/ui';
import { useTransactions } from '@/hooks/use-transactions';

type AssetTransactionsProps = Record<'portfolio', Portfolio> &
  Record<'symbol', string>;

const FIRST_PAGE = 1;
const TRANSACTIONS_PAGE_SIZE = 10;

export const AssetTransactions: FC<AssetTransactionsProps> = ({
  portfolio,
  symbol
}) => {
  const [requestedPage, setRequestedPage] = useState(FIRST_PAGE);
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
      loading={<Skeleton className="h-40 w-full" />}
      isEmpty={({ total }) => total === 0}
      empty={
        <p className="text-sm text-muted-foreground">
          No transactions for this asset
        </p>
      }
    >
      {({ items, page, totalPages }) => (
        <div className="space-y-4">
          <TransactionsTable transactions={items} hasAssetColumn={false} />

          {totalPages > FIRST_PAGE && (
            <nav
              aria-label="Transactions pages"
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= FIRST_PAGE}
                onClick={() => setRequestedPage(page - 1)}
              >
                Previous
              </Button>

              <span
                aria-live="polite"
                className="text-sm text-muted-foreground"
              >
                {`Page ${page} of ${totalPages}`}
              </span>

              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setRequestedPage(page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      )}
    </QuerySection>
  );
};
