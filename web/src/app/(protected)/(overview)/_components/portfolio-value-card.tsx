import type { FC } from 'react';

import { LoaderCircle, TriangleAlert } from 'lucide-react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { formatQuoteTime } from '@/common/utils';
import { Metric, Money, ProfitLoss } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import { Button, Skeleton } from '@/components/ui';
import { usePortfolioOverview } from '@/hooks/use-portfolio';

type PortfolioValueCardProps = Record<'portfolio', Portfolio>;

const VALUE_CLASS = 'text-lg font-semibold';

const TOTAL_VALUE_CLASS = 'text-3xl font-bold';

export const PortfolioValueCard: FC<PortfolioValueCardProps> = ({
  portfolio
}) => {
  const overviewQuery = usePortfolioOverview(portfolio);
  const { isRefetchError, isFetching, refetch } = overviewQuery;

  return (
    <QuerySection
      title="Portfolio value"
      query={overviewQuery}
      errorMessage="The portfolio value could not be loaded"
      loading={
        <div className="space-y-3">
          <Skeleton className="h-9 w-48 max-w-full" />

          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      }
      empty={
        <p className="text-sm text-muted-foreground">
          No holdings to value yet
        </p>
      }
      isEmpty={({ totalValue, quotedAt }) =>
        totalValue === '0' && quotedAt === undefined
      }
    >
      {({
        baseCurrency,
        totalValue,
        dayChange,
        dayChangePercent,
        investedValue,
        profitLoss,
        profitLossPercent,
        quotedAt
      }) => (
        <div className="space-y-5">
          {isRefetchError && (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="flex items-center gap-2 text-sm text-warning">
                <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                The values could not be refreshed and may be out of date
              </p>

              <Button
                variant="secondary"
                className="h-9 gap-2 max-sm:w-full"
                onClick={() => refetch()}
              >
                {isFetching && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                Try again
              </Button>
            </div>
          )}

          <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <Metric label="Total value" valueClassName={TOTAL_VALUE_CLASS}>
              <Money value={totalValue} currency={baseCurrency} />
            </Metric>

            <Metric label="Day change" valueClassName={VALUE_CLASS}>
              <ProfitLoss
                value={dayChange}
                percent={dayChangePercent}
                currency={baseCurrency}
              />
            </Metric>

            <Metric label="Invested" valueClassName={VALUE_CLASS}>
              <Money value={investedValue} currency={baseCurrency} />
            </Metric>

            <Metric label="Profit/Loss" valueClassName={VALUE_CLASS}>
              <ProfitLoss
                value={profitLoss}
                percent={profitLossPercent}
                currency={baseCurrency}
              />
            </Metric>
          </dl>

          {quotedAt && (
            <p className="text-sm text-muted-foreground">
              {'Prices as of '}

              <time dateTime={quotedAt}>{formatQuoteTime(quotedAt)}</time>
            </p>
          )}
        </div>
      )}
    </QuerySection>
  );
};
