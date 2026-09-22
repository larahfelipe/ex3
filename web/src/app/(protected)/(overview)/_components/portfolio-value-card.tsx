import type { FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { formatQuoteTime } from '@/common/utils';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Metric, Money, ProfitLoss } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import { Skeleton } from '@/components/ui';
import { usePortfolioOverview } from '@/hooks/use-portfolio';

type PortfolioValueCardProps = Record<'portfolio', Portfolio>;

const VALUE_CLASS = 'text-lg font-semibold';

const TOTAL_VALUE_CLASS = 'text-3xl font-bold';

export const PortfolioValueCard: FC<PortfolioValueCardProps> = ({
  portfolio
}) => {
  const overviewQuery = usePortfolioOverview(portfolio);

  return (
    <QuerySection
      title="Portfolio value"
      query={overviewQuery}
      errorMessage="The portfolio value could not be loaded"
      loading={
        <LoadingState label="Loading the portfolio value">
          <div className="space-y-3">
            <Skeleton aria-hidden="true" className="h-9 w-48 max-w-full" />

            <Skeleton aria-hidden="true" className="h-5 w-72 max-w-full" />
          </div>
        </LoadingState>
      }
      empty={<EmptyState message="No holdings to value yet" />}
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
