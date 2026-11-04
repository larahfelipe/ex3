import type { FC } from 'react';

import Link from 'next/link';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  MarketDataGapReason,
  MarketDataStatus
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { assetDetailRoute } from '@/common/constants';
import { EmptyState, LoadingState } from '@/components/data-state';
import {
  HEADLINE_VALUE_CLASS,
  Metric,
  Money,
  ProfitLoss,
  PROMINENT_VALUE_CLASS
} from '@/components/financial';
import { InfoTip } from '@/components/info-tip';
import { QuerySection } from '@/components/query-section';
import { RefreshPortfolioButton } from '@/components/refresh-portfolio-button';
import { Skeleton } from '@/components/ui';
import { usePortfolioOverview } from '@/hooks/use-portfolio';
import { useFormat } from '@/i18n/format';
import { isMarketDataDegraded, isValuationIncomplete } from '@/lib/market-data';

type PortfolioValueCardProps = Record<'portfolio', Portfolio>;

type MarketDataNoticeProps = Record<'marketData', MarketDataStatus> &
  Record<'heldPositionCount', number> &
  Record<'baseCurrency', string>;

const GAP_REASONS: MarketDataGapReason[] = ['unavailable', 'not-found'];

const SYMBOL_LINK_CLASS =
  'rounded-sm font-medium underline underline-offset-4 ring-offset-background hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

/**
 * Says what the totals rest on when it is less than every position priced
 * today: which prices or rates are missing and whether trying again can help,
 * as a source that failed may answer later while one that does not know a
 * symbol will not. Missing prices link to their assets, where the symbol can
 * be checked.
 */
const MarketDataNotice: FC<MarketDataNoticeProps> = ({
  marketData,
  heldPositionCount,
  baseCurrency
}) => {
  const t = useTranslations('investments.overview.value.marketData');
  const { formatList } = useFormat();

  if (!isMarketDataDegraded(marketData)) return null;

  const {
    valuedPositionCount,
    missingQuotes,
    missingRates,
    isFallback,
    isStale
  } = marketData;
  const isIncomplete = isValuationIncomplete(marketData);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-warning"
      />

      <div className="space-y-2">
        {isIncomplete && (
          <p className="font-medium">
            {valuedPositionCount < heldPositionCount
              ? t('incomplete', {
                  valued: valuedPositionCount,
                  held: heldPositionCount,
                  currency: baseCurrency
                })
              : t('costUnconverted', { currency: baseCurrency })}
          </p>
        )}

        <ul className="space-y-1.5">
          {GAP_REASONS.map((reason) => {
            const symbols = missingQuotes
              .filter((quote) => quote.reason === reason)
              .map(({ symbol }) => symbol);

            return (
              symbols.length > 0 && (
                <li key={`quotes-${reason}`}>
                  {t.rich(`missingQuotes.${reason}`, {
                    count: symbols.length,
                    symbols: () =>
                      symbols.map((symbol, index) => (
                        <span key={symbol}>
                          {index > 0 && ', '}

                          <Link
                            href={assetDetailRoute(symbol)}
                            className={SYMBOL_LINK_CLASS}
                          >
                            {symbol}
                          </Link>
                        </span>
                      ))
                  })}
                </li>
              )
            );
          })}

          {GAP_REASONS.map((reason) => {
            const currencies = missingRates
              .filter((rate) => rate.reason === reason)
              .map(({ currency }) => currency);

            return (
              currencies.length > 0 && (
                <li key={`rates-${reason}`}>
                  {t(`missingRates.${reason}`, {
                    count: currencies.length,
                    currencies: formatList(currencies),
                    currency: baseCurrency
                  })}
                </li>
              )
            );
          })}

          {isFallback && <li>{t('fallback')}</li>}

          {isStale && <li>{t('stale')}</li>}
        </ul>
      </div>
    </div>
  );
};

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
        quotedAt,
        heldPositionCount,
        marketData
      }) => (
        <div className="space-y-5">
          <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <Metric
              label={t('metrics.totalValue')}
              info={t('overview.value.definitions.totalValue', {
                currency: baseCurrency
              })}
              valueClassName={HEADLINE_VALUE_CLASS}
            >
              <Money value={totalValue} currency={baseCurrency} />
            </Metric>

            <Metric
              label={t('metrics.dayChange')}
              info={t('overview.value.definitions.dayChange')}
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
              info={t('overview.value.definitions.invested', {
                currency: baseCurrency
              })}
              valueClassName={PROMINENT_VALUE_CLASS}
            >
              <Money value={investedValue} currency={baseCurrency} />
            </Metric>

            <Metric
              label={t('metrics.profitLoss')}
              info={t('overview.value.definitions.profitLoss')}
              valueClassName={PROMINENT_VALUE_CLASS}
            >
              <ProfitLoss
                value={profitLoss}
                percent={profitLossPercent}
                currency={baseCurrency}
              />
            </Metric>
          </dl>

          <MarketDataNotice
            marketData={marketData}
            heldPositionCount={heldPositionCount}
            baseCurrency={baseCurrency}
          />

          {quotedAt && (
            <p className="flex items-center gap-0.5 text-sm text-muted-foreground">
              <span>
                {t.rich('metrics.pricesAsOf', {
                  time: formatQuoteTime(quotedAt),
                  quoted: (chunks) => <time dateTime={quotedAt}>{chunks}</time>
                })}
              </span>

              <InfoTip label={t('overview.value.pricesTip')}>
                {t('overview.value.pricesExplanation')}
              </InfoTip>
            </p>
          )}
        </div>
      )}
    </QuerySection>
  );
};
