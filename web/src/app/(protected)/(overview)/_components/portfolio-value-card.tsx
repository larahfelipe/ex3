import type { FC } from 'react';

import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { EmptyState, LoadingState } from '@/components/data-state';
import {
  HEADLINE_VALUE_CLASS,
  Metric,
  Money,
  PROMINENT_VALUE_CLASS,
  ProfitLoss
} from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import { RefreshPortfolioButton } from '@/components/refresh-portfolio-button';
import { Skeleton } from '@/components/ui';
import { usePortfolioOverview } from '@/hooks/use-portfolio';
import { useFormat } from '@/i18n/format';

type PortfolioValueCardProps = Record<'portfolio', Portfolio>;

export const PortfolioValueCard: FC<PortfolioValueCardProps> = ({
  portfolio
}) => {
  const overviewQuery = usePortfolioOverview(portfolio);
  const t = useTranslations('investments');
  const { formatQuoteTime } = useFormat();

  return (
    <QuerySection
      title={t('overview.value.title')}
      action={<RefreshPortfolioButton portfolio={portfolio} />}
      query={overviewQuery}
      errorMessage={t('overview.value.loadFailed')}
      loading={
        <LoadingState label={t('overview.value.loading')}>
          <div className="space-y-3">
            <Skeleton aria-hidden="true" className="h-9 w-48 max-w-full" />

            <Skeleton aria-hidden="true" className="h-5 w-72 max-w-full" />
          </div>
        </LoadingState>
      }
      empty={<EmptyState message={t('overview.value.empty')} />}
      isEmpty={({ heldPositionCount }) => heldPositionCount === 0}
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
            <Metric
              label={t('metrics.totalValue')}
              valueClassName={HEADLINE_VALUE_CLASS}
            >
              <Money value={totalValue} currency={baseCurrency} />
            </Metric>

            <Metric
              label={t('metrics.dayChange')}
              valueClassName={PROMINENT_VALUE_CLASS}
            >
              <ProfitLoss
                value={dayChange}
                percent={dayChangePercent}
                currency={baseCurrency}
              />
            </Metric>

            <Metric
              label={t('metrics.invested')}
              valueClassName={PROMINENT_VALUE_CLASS}
            >
              <Money value={investedValue} currency={baseCurrency} />
            </Metric>

            <Metric
              label={t('metrics.profitLoss')}
              valueClassName={PROMINENT_VALUE_CLASS}
            >
              <ProfitLoss
                value={profitLoss}
                percent={profitLossPercent}
                currency={baseCurrency}
              />
            </Metric>
          </dl>

          {quotedAt && (
            <p className="text-sm text-muted-foreground">
              {t.rich('metrics.pricesAsOf', {
                time: formatQuoteTime(quotedAt),
                quoted: (chunks) => <time dateTime={quotedAt}>{chunks}</time>
              })}
            </p>
          )}
        </div>
      )}
    </QuerySection>
  );
};
