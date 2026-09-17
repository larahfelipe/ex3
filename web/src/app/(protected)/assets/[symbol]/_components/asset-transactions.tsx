import { useState, type FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { QuerySection } from '@/components/query-section';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { TransactionsTable } from '@/components/transactions-table';
import { Button, Skeleton } from '@/components/ui';
import {
  useCreateTransaction,
  useTransactions
} from '@/hooks/use-transactions';

type AssetTransactionsProps = Record<'portfolio', Portfolio> &
  Record<'symbol', string>;

const FIRST_PAGE = 1;
const TRANSACTIONS_PAGE_SIZE = 10;

export const AssetTransactions: FC<AssetTransactionsProps> = ({
  portfolio,
  symbol
}) => {
  const [requestedPage, setRequestedPage] = useState(FIRST_PAGE);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);

  const transactionsQuery = useTransactions(portfolio, {
    symbol,
    page: requestedPage,
    pageSize: TRANSACTIONS_PAGE_SIZE
  });

  const { mutateAsync: createTransaction } = useCreateTransaction(portfolio);

  return (
    <>
      <QuerySection
        title="Transactions"
        action={
          <Button size="sm" onClick={() => setIsAddingTransaction(true)}>
            Add transaction
          </Button>
        }
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
        {({ items, page, totalPages }) =>
          items.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                {`No transactions on page ${page}`}
              </p>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRequestedPage(totalPages)}
              >
                {`Go to page ${totalPages}`}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <TransactionsTable
                portfolio={portfolio}
                transactions={items}
                hasAssetColumn={false}
              />

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
          )
        }
      </QuerySection>

      {isAddingTransaction && (
        <TransactionFormDialog
          target={{
            kind: 'create',
            symbol,
            currency: portfolio.baseCurrency
          }}
          onCancel={() => setIsAddingTransaction(false)}
          onSubmit={async (draft) => {
            await createTransaction({ ...draft, assetSymbol: symbol });
            setIsAddingTransaction(false);
          }}
        />
      )}
    </>
  );
};
