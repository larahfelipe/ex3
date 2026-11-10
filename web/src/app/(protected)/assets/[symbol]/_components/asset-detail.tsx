'use client';

import { useId, useMemo, useState, type FC } from 'react';

import Link from 'next/link';

import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  InstrumentType,
  PositionDetail,
  PriceChange,
  PriceClose,
  PriceIndicators,
  ReturnIndicators
} from '@/app/api/v1/portfolio';
import { APP_ROUTES } from '@/common/constants';
import { signOf, type ValueSign } from '@/common/utils';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import {
  HEADLINE_VALUE_CLASS,
  Metric,
  Money,
  Percentage,
  Price,
  ProfitLoss,
  PROMINENT_VALUE_CLASS,
  Quantity,
  Trend
} from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PerformanceChart } from '@/components/performance-chart';
import { QuerySection } from '@/components/query-section';
import { SectionHeader } from '@/components/section-header';
import { SeriesChart, type SeriesTone } from '@/components/series-chart';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';
import {
  useActivePortfolio,
  usePosition,
  usePositionFundamentals,
  usePositionIndicators
} from '@/hooks/use-portfolio';
import { useCreateTransaction } from '@/hooks/use-transactions';
import { useFormat } from '@/i18n/format';
import { isNotFoundError } from '@/lib/axios';
import { APPEAR_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Children, Maybe } from '@/types';

import { FundamentalsSection } from './asset-fundamentals';
import { AssetTransactions } from './asset-transactions';

type AssetDetailProps = Record<'symbol', string>;

type DetailSectionProps = Children & Record<'title', string>;

type PositionSectionProps = Record<'position', PositionDetail>;

type IndicatorsQuery = ReturnType<typeof usePositionIndicators>;

type IndicatorsQueryProps = Record<'query', IndicatorsQuery>;

type MarketSectionProps = PositionSectionProps & IndicatorsQueryProps;

type PriceIndicatorsProps = Record<'prices', PriceIndicators>;

type OpenedPriceChange = Extract<PriceChange, Record<'openedOn', string>>;

type PriceChartProps = Record<'closes', ReadonlyArray<PriceClose>> &
  Record<'currency', string> &
  Record<'tone', SeriesTone> &
  Partial<Record<'className', string>>;

type ReturnsSectionProps = Pick<PositionDetail, 'type'> & IndicatorsQueryProps;

type PositionReturnsProps = Pick<PositionDetail, 'type'> &
  Record<'returns', ReturnIndicators>;

type IncomeKind = 'income' | 'interest';

/**
 * What a class pays its holders. A class mapped to `null` pays nothing, so its
 * income shows only once its ledger records some, under the recorded kind.
 */
const INCOME_KINDS: Record<InstrumentType, Maybe<IncomeKind>> = {
  STOCK: 'income',
  ETF: 'income',
  FUND: 'income',
  REIT: 'income',
  BOND: 'interest',
  TREASURY: 'interest',
  CRYPTO: null,
  CASH: null,
  OTHER: null
};

const RECORDED_INCOME_KIND: IncomeKind = 'income';

const WHOLE_BAR_PERCENT = 100;

/** A year whose closes never moved has no span to place the close in. */
const FLAT_YEAR_PLACEMENT = 0.5;

const CHANGE_TONES: Record<ValueSign, SeriesTone> = {
  negative: 'negative',
  zero: 'primary',
  positive: 'positive'
};

const WHOLE_HISTORY_KEY = 'whole-history';

const DetailSection: FC<DetailSectionProps> = ({ title, children }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card className="h-full">
        <SectionHeader id={headingId} title={title} />

        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </section>
  );
};

/**
 * The prices become numbers here only to place the close on the bar: every
 * price the reader sees is formatted from the decimal string the API sent.
 */
const closePlacementOf = ({ close, yearLow, yearHigh }: PriceIndicators) => {
  const low = Number(yearLow);
  const span = Number(yearHigh) - low;

  return span === 0 ? FLAT_YEAR_PLACEMENT : (Number(close) - low) / span;
};

const YearRange: FC<PriceIndicatorsProps> = ({ prices }) => {
  const t = useTranslations('investments.asset.market');
  const { currency, yearLow, yearHigh } = prices;
  const closeOffset = `${closePlacementOf(prices) * WHOLE_BAR_PERCENT}%`;

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground">{t('yearRange')}</h3>

      <div aria-hidden="true" className="relative h-1.5 rounded-full bg-muted">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
          style={{ width: closeOffset }}
        />

        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
          style={{ left: closeOffset }}
        />
      </div>

      <dl className="flex justify-between gap-4">
        <Metric label={t('yearLow')}>
          <Price value={yearLow} currency={currency} />
        </Metric>

        <Metric label={t('yearHigh')} className="text-right">
          <Price value={yearHigh} currency={currency} />
        </Metric>
      </dl>
    </div>
  );
};

/**
 * The window that opens earliest, one year whenever the history reaches it.
 * ISO instants in UTC, as the API sends them, order as text.
 */
const longestChangeOf = (changes: ReadonlyArray<PriceChange>) =>
  changes.reduce<OpenedPriceChange | undefined>(
    (longest, change) =>
      change.openedOn !== undefined &&
      (longest === undefined || change.openedOn <= longest.openedOn)
        ? change
        : longest,
    undefined
  );

/**
 * Closes, not candles: the history keeps one price per day, and a line reads
 * the direction of a window at a glance in the room the card leaves it.
 */
const PriceChart: FC<PriceChartProps> = ({
  closes,
  currency,
  tone,
  className
}) => {
  const t = useTranslations('investments.asset.market');
  const { formatSeriesDay, formatUnitAmount } = useFormat();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const values = useMemo(() => closes.map(({ close }) => close), [closes]);

  const first = closes[0];
  const last = closes[closes.length - 1];
  const active = closes.at(activeIndex ?? -1) ?? last;

  return (
    <figure className={cn('space-y-2', APPEAR_CLASS, className)}>
      <SeriesChart
        values={values}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        tone={tone}
        baseline={first.close}
        className="h-36"
        label={t('chartLabel')}
        describePoint={(index) =>
          t('closeOn', {
            price: formatUnitAmount(closes[index].close, currency),
            day: formatSeriesDay(closes[index].closedOn)
          })
        }
        tooltip={
          <>
            <p className="font-medium">{formatSeriesDay(active.closedOn)}</p>

            <p>
              <Price value={active.close} currency={currency} />
            </p>
          </>
        }
      />

      <figcaption className="flex justify-between gap-4 text-xs text-muted-foreground">
        <span className="sr-only">
          {t('closesBetween', {
            firstPrice: formatUnitAmount(first.close, currency),
            firstDay: formatSeriesDay(first.closedOn),
            lastPrice: formatUnitAmount(last.close, currency),
            lastDay: formatSeriesDay(last.closedOn)
          })}
        </span>

        <time aria-hidden="true" dateTime={first.closedOn}>
          {formatSeriesDay(first.closedOn)}
        </time>

        <time aria-hidden="true" dateTime={last.closedOn}>
          {formatSeriesDay(last.closedOn)}
        </time>
      </figcaption>
    </figure>
  );
};

/**
 * The windows' changes select what the chart draws: from the window's opening
 * close, the dashed line, to the latest. Without any change, the chart draws
 * every close the history has.
 */
const PriceMovement: FC<PriceIndicatorsProps> = ({ prices }) => {
  const t = useTranslations('investments');
  const { formatSeriesDay } = useFormat();
  const { currency, close, closedOn, changes, closes } = prices;
  const rangeInputName = useId();
  const [selectedRange, setSelectedRange] = useState(
    () => longestChangeOf(changes)?.range
  );
  const selected = changes.find(
    (change): change is OpenedPriceChange =>
      change.range === selectedRange && change.openedOn !== undefined
  );
  const chartCloses = useMemo(
    () =>
      selected === undefined
        ? closes
        : closes.filter((dayClose) => dayClose.closedOn >= selected.openedOn),
    [closes, selected]
  );

  return (
    <div className={cn('space-y-4 border-t pt-5', APPEAR_CLASS)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <fieldset className="min-w-0 lg:col-start-1 lg:row-start-1">
          <legend className="mb-3 text-sm text-muted-foreground">
            {t('asset.market.priceChange')}
          </legend>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {changes.map(({ range, change }) => (
              <label
                key={range}
                className="block cursor-pointer space-y-1 rounded-lg border border-transparent bg-muted px-3 py-2 ring-offset-background transition-colors hover:border-input has-checked:border-primary/40 has-checked:bg-primary/10 has-focus-visible:ring-2 has-focus-visible:ring-focus has-focus-visible:ring-offset-2 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:border-transparent"
              >
                <input
                  type="radio"
                  name={rangeInputName}
                  value={range}
                  checked={range === selectedRange}
                  disabled={change === undefined}
                  onChange={() => setSelectedRange(range)}
                  className="sr-only"
                />

                <span className="block text-sm text-muted-foreground">
                  {t(`performance.ranges.${range}`)}
                </span>

                <span className="block font-semibold">
                  <Trend value={change} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {chartCloses.length > 1 && (
          <PriceChart
            key={selectedRange ?? WHOLE_HISTORY_KEY}
            closes={chartCloses}
            currency={currency}
            tone={
              selected === undefined
                ? 'primary'
                : CHANGE_TONES[signOf(selected.change)]
            }
            className="lg:col-span-2 lg:row-start-2"
          />
        )}

        <div className="lg:col-start-2 lg:row-start-1">
          <YearRange prices={prices} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t.rich('asset.market.changesSince', {
          day: formatSeriesDay(closedOn),
          price: () => <Price value={close} currency={currency} />,
          closed: (chunks) => <time dateTime={closedOn}>{chunks}</time>
        })}
      </p>
    </div>
  );
};

const PriceHistory: FC<IndicatorsQueryProps> = ({
  query: { data, isError, refetch }
}) => {
  const t = useTranslations('investments.asset.market');

  if (data === undefined)
    return (
      <div className="border-t pt-5">
        {isError ? (
          <ErrorState message={t('historyLoadFailed')} onRetry={refetch} />
        ) : (
          <LoadingState label={t('historyLoading')}>
            <div className="space-y-4">
              <Skeleton aria-hidden="true" className="h-16 w-full" />

              <Skeleton aria-hidden="true" className="h-36 w-full" />
            </div>
          </LoadingState>
        )}
      </div>
    );

  return data.prices === undefined ? null : (
    <PriceMovement prices={data.prices} />
  );
};

const MarketSection: FC<MarketSectionProps> = ({
  position: { type, market, currency, sector, quote },
  query
}) => {
  const t = useTranslations('investments');
  const { formatQuoteTime } = useFormat();

  return (
    <DetailSection title={t('asset.market.title')}>
      <div className="space-y-3">
        <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <Metric
            label={t('asset.market.price')}
            valueClassName={HEADLINE_VALUE_CLASS}
          >
            <Price value={quote?.price} currency={quote?.currency} />
          </Metric>

          <Metric
            label={t('asset.market.dayChange')}
            valueClassName={PROMINENT_VALUE_CLASS}
          >
            <ProfitLoss
              value={quote?.dayChange}
              percent={quote?.dayChangePercent}
              currency={quote?.currency}
            />
          </Metric>

          <Metric
            label={t('asset.market.previousClose')}
            valueClassName={PROMINENT_VALUE_CLASS}
          >
            <Price value={quote?.previousClose} currency={quote?.currency} />
          </Metric>
        </dl>

        {quote !== undefined && (
          <p className="text-sm text-muted-foreground">
            {t.rich('asset.market.priceAsOf', {
              time: formatQuoteTime(quote.timestamp),
              quoted: (chunks) => (
                <time dateTime={quote.timestamp}>{chunks}</time>
              )
            })}
          </p>
        )}
      </div>

      <PriceHistory query={query} />

      <dl className="grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
        <Metric label={t('asset.market.type')}>
          {t(`instrumentTypes.${type}`)}
        </Metric>

        {typeof market === 'string' && (
          <Metric label={t('asset.market.market')}>{market}</Metric>
        )}

        {typeof currency === 'string' && (
          <Metric label={t('asset.market.currency')}>{currency}</Metric>
        )}

        {typeof sector === 'string' && (
          <Metric label={t('asset.market.sector')}>{sector}</Metric>
        )}
      </dl>
    </DetailSection>
  );
};

const PositionSection: FC<PositionSectionProps> = ({
  position: {
    baseCurrency,
    quantity,
    averageCost,
    marketPrice,
    marketValue,
    allocation,
    profitLoss,
    profitLossPercent
  }
}) => {
  const t = useTranslations('investments.asset.position');

  return (
    <DetailSection title={t('title')}>
      <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Metric label={t('marketValue')} valueClassName={HEADLINE_VALUE_CLASS}>
          <Money value={marketValue} currency={baseCurrency} />
        </Metric>

        <Metric
          label={t('unrealizedProfitLoss')}
          valueClassName={PROMINENT_VALUE_CLASS}
        >
          <ProfitLoss
            value={profitLoss}
            percent={profitLossPercent}
            currency={baseCurrency}
          />
        </Metric>
      </dl>

      <dl className="grid grid-cols-2 gap-4 border-t pt-5">
        <Metric label={t('quantity')}>
          <Quantity value={quantity} />
        </Metric>

        <Metric label={t('averageCost')}>
          <Price value={averageCost} currency={baseCurrency} />
        </Metric>

        <Metric label={t('marketPrice')}>
          <Price value={marketPrice} currency={baseCurrency} />
        </Metric>

        <Metric label={t('allocation')}>
          <Percentage value={allocation} />
        </Metric>
      </dl>
    </DetailSection>
  );
};

const PositionReturns: FC<PositionReturnsProps> = ({
  type,
  returns: {
    currency,
    since,
    realizedProfitLoss,
    income,
    trailingIncome,
    yieldOnCost
  }
}) => {
  const t = useTranslations('investments.asset.returns');
  const { formatExecutionDay } = useFormat();
  const incomeKind =
    INCOME_KINDS[type] ?? (income === '0' ? null : RECORDED_INCOME_KIND);

  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Metric
          label={t('realizedProfitLoss')}
          valueClassName={HEADLINE_VALUE_CLASS}
        >
          <ProfitLoss value={realizedProfitLoss} currency={currency} />
        </Metric>

        {incomeKind !== null && (
          <Metric
            label={t('incomeReceived', { kind: incomeKind })}
            valueClassName={PROMINENT_VALUE_CLASS}
          >
            <Money value={income} currency={currency} />
          </Metric>
        )}
      </dl>

      <dl className="grid grid-cols-2 gap-4 border-t pt-5">
        {incomeKind !== null && (
          <>
            <Metric label={t('trailingIncome', { kind: incomeKind })}>
              <Money value={trailingIncome} currency={currency} />
            </Metric>

            <Metric label={t('yieldOnCost')} info={t('yieldOnCostExplanation')}>
              <Percentage value={yieldOnCost} />
            </Metric>
          </>
        )}

        <Metric label={t('since')}>
          <time dateTime={since}>{formatExecutionDay(since)}</time>
        </Metric>
      </dl>
    </div>
  );
};

const ReturnsSection: FC<ReturnsSectionProps> = ({ type, query }) => {
  const t = useTranslations('investments.asset.returns');

  return (
    <QuerySection
      title={t('title')}
      query={query}
      errorMessage={t('loadFailed')}
      loading={<LoadingState label={t('loading')} className="h-32" />}
      isEmpty={({ returns }) => returns === undefined}
      empty={<EmptyState message={t('empty')} />}
    >
      {({ returns }) =>
        returns !== undefined && (
          <PositionReturns type={type} returns={returns} />
        )
      }
    </QuerySection>
  );
};

export const AssetDetail: FC<AssetDetailProps> = ({ symbol }) => {
  const t = useTranslations('investments');
  const {
    data: portfolio,
    isPending,
    isError,
    isSuccess,
    refetch
  } = useActivePortfolio();
  const positionQuery = usePosition(portfolio, symbol);
  const indicatorsQuery = usePositionIndicators(portfolio, symbol);
  const fundamentalsQuery = usePositionFundamentals(portfolio, symbol);
  const { mutateAsync: createTransaction } = useCreateTransaction(portfolio);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  const { data: position, error: positionError } = positionQuery;

  const isPositionPending =
    portfolio !== undefined && portfolio !== null && positionQuery.isPending;
  const isAssetMissing =
    positionError !== null && isNotFoundError(positionError);
  const heldPosition = isAssetMissing ? undefined : position;

  return (
    <div className="space-y-6">
      <PageHeader
        title={heldPosition?.symbol ?? symbol.toUpperCase()}
        isPending={isPending || isPositionPending}
        description={heldPosition?.name}
        action={
          portfolio &&
          heldPosition && (
            <Button
              size="sm"
              className="gap-1.5 max-sm:w-full"
              onClick={() => setIsAddingTransaction(true)}
            >
              <Plus size={16} aria-hidden="true" />

              {t('asset.addTransaction')}
            </Button>
          )
        }
        navigation={
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto gap-1.5 p-0 text-muted-foreground"
          >
            <Link href={APP_ROUTES.Protected.Assets}>
              <ArrowLeft aria-hidden="true" className="size-4" />

              {t('asset.back')}
            </Link>
          </Button>
        }
      />

      {isPending && (
        <LoadingState label={t('overview.loading')} className="h-64" />
      )}

      {isError && !portfolio && (
        <ErrorState message={t('overview.loadFailed')} onRetry={refetch} />
      )}

      {isSuccess && !portfolio && (
        <EmptyState
          message={t('overview.noPortfolio')}
          action={{
            label: t('overview.createPortfolio'),
            href: APP_ROUTES.Protected.Portfolios
          }}
        />
      )}

      {isPositionPending && (
        <LoadingState label={t('asset.loading')}>
          <div className="space-y-6">
            <Skeleton aria-hidden="true" className="h-72 w-full rounded-2xl" />

            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton
                aria-hidden="true"
                className="h-64 w-full rounded-2xl"
              />

              <Skeleton
                aria-hidden="true"
                className="h-64 w-full rounded-2xl"
              />
            </div>
          </div>
        </LoadingState>
      )}

      {isAssetMissing && (
        <EmptyState
          message={t('asset.notHeld', { symbol: symbol.toUpperCase() })}
          action={{
            label: t('asset.viewAssets'),
            href: APP_ROUTES.Protected.Assets
          }}
        />
      )}

      {positionError !== null && !isAssetMissing && position === undefined && (
        <ErrorState
          message={t('asset.loadFailed')}
          onRetry={positionQuery.refetch}
        />
      )}

      {portfolio && heldPosition && (
        <>
          <MarketSection position={heldPosition} query={indicatorsQuery} />

          <div className="grid gap-6 lg:grid-cols-2">
            <PositionSection position={heldPosition} />

            <ReturnsSection type={heldPosition.type} query={indicatorsQuery} />
          </div>

          <FundamentalsSection query={fundamentalsQuery} />

          <PerformanceChart
            portfolio={portfolio}
            symbol={heldPosition.symbol}
          />

          <AssetTransactions
            portfolio={portfolio}
            symbol={heldPosition.symbol}
          />

          {isAddingTransaction && (
            <TransactionFormDialog
              portfolio={portfolio}
              target={{
                kind: 'create',
                symbol: heldPosition.symbol,
                currency: portfolio.baseCurrency
              }}
              onCancel={() => setIsAddingTransaction(false)}
              onSubmit={async (draft) => {
                await createTransaction({
                  ...draft,
                  assetSymbol: heldPosition.symbol
                });
                setIsAddingTransaction(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
