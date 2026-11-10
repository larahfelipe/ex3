import type { FC } from 'react';

import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { Metric, Money } from '@/components/financial';
import { Button, Skeleton } from '@/components/ui';
import { usePortfolioOverview } from '@/hooks/use-portfolio';

type PortfolioTotalValueProps = Record<'portfolio', Portfolio>;

const STATUS_CLASS = 'text-sm font-normal text-muted-foreground';

/**
 * The overview's total value, read through the query the overview page uses, so
 * a change to the portfolio's assets or transactions refreshes it here too.
 */
export const PortfolioTotalValue: FC<PortfolioTotalValueProps> = ({
  portfolio
}) => {
  const { data: overview, isError, refetch } = usePortfolioOverview(portfolio);
  const t = useTranslations('portfolios.totalValue');
  const tCommon = useTranslations('common');

  const renderValue = () => {
    if (overview === undefined && isError)
      return (
        <span className="flex items-center justify-end gap-2">
          <span className="text-sm font-normal text-negative">
            {t('loadFailed')}
          </span>

          <Button
            variant="outline"
            size="xxs"
            aria-label={t('retry', { name: portfolio.name })}
            onClick={() => void refetch()}
          >
            {tCommon('actions.retry')}
          </Button>
        </span>
      );

    if (overview === undefined)
      return (
        <>
          <Skeleton aria-hidden="true" className="h-6 w-28" />

          <span className="sr-only">{tCommon('states.loading')}</span>
        </>
      );

    if (overview.heldPositionCount === 0)
      return <span className={STATUS_CLASS}>{t('noHoldings')}</span>;

    if (overview.totalValue === undefined)
      return <span className={STATUS_CLASS}>{t('marketDataUnavailable')}</span>;

    return (
      <Money value={overview.totalValue} currency={overview.baseCurrency} />
    );
  };

  return (
    <dl className="shrink-0 text-right">
      <Metric
        label={t('label')}
        className="space-y-0.5"
        valueClassName="flex min-h-6 items-center justify-end tabular-nums"
      >
        {renderValue()}
      </Metric>
    </dl>
  );
};
