'use client';

import { useId, useState, type FC } from 'react';

import Link from 'next/link';

import { ArrowLeft, Plus } from 'lucide-react';

import type {
  InstrumentType,
  PositionDetail,
  PriceIndicators,
  ReturnIndicators
} from '@/app/api/v1/portfolio';
import { APP_ROUTES, INSTRUMENT_TYPE_LABELS } from '@/common/constants';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import {
  HEADLINE_VALUE_CLASS,
  Metric,
  Money,
  Percentage,
  Price,
  PROMINENT_VALUE_CLASS,
  ProfitLoss,
  Quantity,
  Trend
} from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PerformanceChart } from '@/components/performance-chart';
import { QuerySection } from '@/components/query-section';
import { SectionHeader } from '@/components/section-header';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';
import {
  usePosition,
  usePositionIndicators,
  useActivePortfolio
} from '@/hooks/use-portfolio';
import { useCreateTransaction } from '@/hooks/use-transactions';
import { isNotFoundError } from '@/lib/axios';
import {
  formatExecutionDay,
  formatQuoteTime,
  formatSeriesDay
} from '@/lib/dates';
import type { Children, Maybe } from '@/types';

import { AssetTransactions } from './asset-transactions';

type AssetDetailProps = Record<'symbol', string>;

type DetailSectionProps = Children & Record<'title', string>;

type PositionSectionProps = Record<'position', PositionDetail>;

type IndicatorsQuery = ReturnType<typeof usePositionIndicators>;

type IndicatorsQueryProps = Record<'query', IndicatorsQuery>;

type MarketSectionProps = PositionSectionProps & IndicatorsQueryProps;

type PriceIndicatorsProps = Record<'prices', PriceIndicators>;

type ReturnsSectionProps = Pick<PositionDetail, 'type'> & IndicatorsQueryProps;

type PositionReturnsProps = Pick<PositionDetail, 'type'> &
  Record<'returns', ReturnIndicators>;

/**
 * What a class pays its holders. A class mapped to `null` pays nothing, so its
 * income shows only once its ledger records some, under the recorded name.
 */
const INCOME_NAMES: Record<InstrumentType, Maybe<string>> = {
  STOCK: 'Income',
  ETF: 'Income',
  FUND: 'Income',
  REIT: 'Income',
  BOND: 'Interest',
  TREASURY: 'Interest',
  CRYPTO: null,
  CASH: null,
  OTHER: null
};

const RECORDED_INCOME_NAME = 'Income';

const WHOLE_BAR_PERCENT = 100;

/** A year whose closes never moved has no span to place the close in. */
const FLAT_YEAR_PLACEMENT = 0.5;

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
  const { currency, yearLow, yearHigh } = prices;
  const closeOffset = `${closePlacementOf(prices) * WHOLE_BAR_PERCENT}%`;

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground">52-week range</h3>

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
        <Metric label="Low">
          <Price value={yearLow} currency={currency} />
        </Metric>

        <Metric label="High" className="text-right">
          <Price value={yearHigh} currency={currency} />
        </Metric>
      </dl>
    </div>
  );
};

const PriceMovement: FC<PriceIndicatorsProps> = ({ prices }) => {
  const { currency, close, closedOn, changes } = prices;

  return (
    <div className="space-y-4 border-t pt-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <h3 className="text-sm text-muted-foreground">Price change</h3>

          <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {changes.map(({ range, change }) => (
              <Metric
                key={range}
                label={range}
                className="rounded-lg bg-muted px-3 py-2"
                valueClassName="font-semibold"
              >
                <Trend value={change} />
              </Metric>
            ))}
          </dl>
        </div>

        <YearRange prices={prices} />
      </div>

      <p className="text-xs text-muted-foreground">
        {'Changes to the last close, '}

        <Price value={close} currency={currency} />

        {' on '}

        <time dateTime={closedOn}>{formatSeriesDay(closedOn)}</time>
      </p>
    </div>
  );
};

const PriceHistory: FC<IndicatorsQueryProps> = ({
  query: { data, isError, refetch }
}) => {
  if (data === undefined)
    return (
      <div className="border-t pt-5">
        {isError ? (
          <ErrorState
            message="The price history could not be loaded"
            onRetry={refetch}
          />
        ) : (
          <LoadingState label="Loading the price history" className="h-24" />
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
}) => (
  <DetailSection title="Market">
    <div className="space-y-3">
      <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Metric label="Price" valueClassName={HEADLINE_VALUE_CLASS}>
          <Price value={quote?.price} currency={quote?.currency} />
        </Metric>

        <Metric label="Day change" valueClassName={PROMINENT_VALUE_CLASS}>
          <ProfitLoss
            value={quote?.dayChange}
            percent={quote?.dayChangePercent}
            currency={quote?.currency}
          />
        </Metric>

        <Metric label="Previous close" valueClassName={PROMINENT_VALUE_CLASS}>
          <Price value={quote?.previousClose} currency={quote?.currency} />
        </Metric>
      </dl>

      {quote !== undefined && (
        <p className="text-sm text-muted-foreground">
          {'Price as of '}

          <time dateTime={quote.timestamp}>
            {formatQuoteTime(quote.timestamp)}
          </time>
        </p>
      )}
    </div>

    <PriceHistory query={query} />

    <dl className="grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
      <Metric label="Class">{INSTRUMENT_TYPE_LABELS[type]}</Metric>

      {typeof market === 'string' && <Metric label="Market">{market}</Metric>}

      {typeof currency === 'string' && (
        <Metric label="Currency">{currency}</Metric>
      )}

      {typeof sector === 'string' && <Metric label="Sector">{sector}</Metric>}
    </dl>
  </DetailSection>
);

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
}) => (
  <DetailSection title="Position">
    <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
      <Metric label="Market value" valueClassName={HEADLINE_VALUE_CLASS}>
        <Money value={marketValue} currency={baseCurrency} />
      </Metric>

      <Metric
        label="Unrealized profit/loss"
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
      <Metric label="Quantity">
        <Quantity value={quantity} />
      </Metric>

      <Metric label="Average cost">
        <Price value={averageCost} currency={baseCurrency} />
      </Metric>

      <Metric label="Market price">
        <Price value={marketPrice} currency={baseCurrency} />
      </Metric>

      <Metric label="Allocation">
        <Percentage value={allocation} />
      </Metric>
    </dl>
  </DetailSection>
);

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
  const incomeName =
    INCOME_NAMES[type] ?? (income === '0' ? null : RECORDED_INCOME_NAME);

  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <Metric
          label="Realized profit/loss"
          valueClassName={HEADLINE_VALUE_CLASS}
        >
          <ProfitLoss value={realizedProfitLoss} currency={currency} />
        </Metric>

        {incomeName !== null && (
          <Metric
            label={`${incomeName} received`}
            valueClassName={PROMINENT_VALUE_CLASS}
          >
            <Money value={income} currency={currency} />
          </Metric>
        )}
      </dl>

      <dl className="grid grid-cols-2 gap-4 border-t pt-5">
        {incomeName !== null && (
          <>
            <Metric label={`${incomeName} (12M)`}>
              <Money value={trailingIncome} currency={currency} />
            </Metric>

            <Metric
              label="Yield on cost (12M)"
              info="Income received in the last 12 months divided by what the position cost."
            >
              <Percentage value={yieldOnCost} />
            </Metric>
          </>
        )}

        <Metric label="First transaction">
          <time dateTime={since}>{formatExecutionDay(since)}</time>
        </Metric>
      </dl>
    </div>
  );
};

const ReturnsSection: FC<ReturnsSectionProps> = ({ type, query }) => (
  <QuerySection
    title="Returns"
    query={query}
    errorMessage="The returns could not be loaded"
    loading={<LoadingState label="Loading the returns" className="h-32" />}
    isEmpty={({ returns }) => returns === undefined}
    empty={<EmptyState message="Returns start with the first transaction" />}
  >
    {({ returns }) =>
      returns !== undefined && <PositionReturns type={type} returns={returns} />
    }
  </QuerySection>
);

export const AssetDetail: FC<AssetDetailProps> = ({ symbol }) => {
  const {
    data: portfolio,
    isPending,
    isError,
    isSuccess,
    refetch
  } = useActivePortfolio();
  const positionQuery = usePosition(portfolio, symbol);
  const indicatorsQuery = usePositionIndicators(portfolio, symbol);
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
              Add transaction
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
              Back to assets
            </Link>
          </Button>
        }
      />

      {isPending && (
        <LoadingState label="Loading your portfolio" className="h-64" />
      )}

      {isError && !portfolio && (
        <ErrorState
          message="Your portfolio could not be loaded"
          onRetry={refetch}
        />
      )}

      {isSuccess && !portfolio && (
        <EmptyState
          message="No portfolio found for this account"
          action={{
            label: 'Create a portfolio',
            href: APP_ROUTES.Protected.Portfolios
          }}
        />
      )}

      {isPositionPending && (
        <LoadingState label="Loading this asset">
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
          message={`${symbol.toUpperCase()} is not in your portfolio`}
          action={{
            label: 'View your assets',
            href: APP_ROUTES.Protected.Assets
          }}
        />
      )}

      {positionError !== null && !isAssetMissing && position === undefined && (
        <ErrorState
          message="This asset could not be loaded"
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
