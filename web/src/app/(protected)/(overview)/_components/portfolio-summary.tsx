import { useId, type FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { Skeleton } from '@/components/ui';
import { usePortfolioOverview } from '@/hooks/use-portfolio';
import type { Children } from '@/types';

import { Amount, SignedAmount } from './amounts';
import { LoadErrorAlert } from './overview-section';

type PortfolioSummaryProps = Record<'portfolio', Portfolio>;

type SummaryItemProps = Children & Record<'label', string>;

const SummaryItem: FC<SummaryItemProps> = ({ label, children }) => (
  <div className="space-y-2 rounded-3xl bg-card p-5">
    <dt className="text-sm text-muted-foreground">{label}</dt>

    <dd className="text-xl font-semibold">{children}</dd>
  </div>
);

const valuePlaceholder = <Skeleton className="h-7 w-2/3" />;

export const PortfolioSummary: FC<PortfolioSummaryProps> = ({ portfolio }) => {
  const headingId = useId();
  const { data: overview, isError, refetch } = usePortfolioOverview(portfolio);

  const isLoading = overview === undefined && !isError;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        Summary
      </h2>

      {overview === undefined && isError ? (
        <div className="rounded-3xl bg-card p-6">
          <LoadErrorAlert
            message="The portfolio summary could not be loaded"
            onRetry={refetch}
          />
        </div>
      ) : (
        <dl
          aria-busy={isLoading}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SummaryItem label="Total value">
            {overview ? (
              <Amount
                amount={overview.totalValue}
                currency={overview.baseCurrency}
              />
            ) : (
              valuePlaceholder
            )}
          </SummaryItem>

          <SummaryItem label="Invested">
            {overview ? (
              <Amount
                amount={overview.investedValue}
                currency={overview.baseCurrency}
              />
            ) : (
              valuePlaceholder
            )}
          </SummaryItem>

          <SummaryItem label="Profit/Loss">
            {overview ? (
              <SignedAmount
                amount={overview.profitLoss}
                percent={overview.profitLossPercent}
                currency={overview.baseCurrency}
              />
            ) : (
              valuePlaceholder
            )}
          </SummaryItem>

          <SummaryItem label="Day change">
            {overview ? (
              <SignedAmount
                amount={overview.dayChange}
                percent={overview.dayChangePercent}
                currency={overview.baseCurrency}
              />
            ) : (
              valuePlaceholder
            )}
          </SummaryItem>
        </dl>
      )}
    </section>
  );
};
