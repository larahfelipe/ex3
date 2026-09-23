'use client';

import { useId, type FC } from 'react';

import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import type { PositionDetail } from '@/app/api/v1/portfolio';
import { APP_ROUTES, INSTRUMENT_TYPE_LABELS } from '@/common/constants';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import {
  Metric,
  Money,
  Percentage,
  Price,
  ProfitLoss,
  Quantity,
  UnavailableValue
} from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PerformanceChart } from '@/components/performance-chart';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';
import { usePosition, useActivePortfolio } from '@/hooks/use-portfolio';
import { isNotFoundError } from '@/lib/axios';
import { formatQuoteTime } from '@/lib/dates';
import type { Children } from '@/types';

import { AssetTransactions } from './asset-transactions';

type AssetDetailProps = Record<'symbol', string>;

type DetailSectionProps = Children & Record<'title', string>;

type PositionSectionProps = Record<'position', PositionDetail>;

const DetailSection: FC<DetailSectionProps> = ({ title, children }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card className="h-full shadow-none">
        <SectionHeader id={headingId} title={title} />

        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
        </CardContent>
      </Card>
    </section>
  );
};

const QuoteOverview: FC<PositionSectionProps> = ({
  position: { type, market, currency, sector, quote }
}) => (
  <DetailSection title="Overview">
    <Metric label="Price">
      <Price value={quote?.price} currency={quote?.currency} />
    </Metric>

    <Metric label="Day change">
      <ProfitLoss
        value={quote?.dayChange}
        percent={quote?.dayChangePercent}
        currency={quote?.currency}
      />
    </Metric>

    <Metric label="Previous close">
      <Price value={quote?.previousClose} currency={quote?.currency} />
    </Metric>

    <Metric label="Quoted at">
      {quote === undefined ? (
        <UnavailableValue />
      ) : (
        <time dateTime={quote.timestamp}>
          {formatQuoteTime(quote.timestamp)}
        </time>
      )}
    </Metric>

    <Metric label="Class">{INSTRUMENT_TYPE_LABELS[type]}</Metric>

    <Metric label="Market">{market ?? <UnavailableValue />}</Metric>

    <Metric label="Currency">{currency ?? <UnavailableValue />}</Metric>

    <Metric label="Sector">{sector ?? <UnavailableValue />}</Metric>
  </DetailSection>
);

const PositionValues: FC<PositionSectionProps> = ({
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
    <Metric label="Quantity">
      <Quantity value={quantity} />
    </Metric>

    <Metric label="Average cost">
      <Price value={averageCost} currency={baseCurrency} />
    </Metric>

    <Metric label="Market price">
      <Price value={marketPrice} currency={baseCurrency} />
    </Metric>

    <Metric label="Market value">
      <Money value={marketValue} currency={baseCurrency} />
    </Metric>

    <Metric label="Allocation">
      <Percentage value={allocation} />
    </Metric>

    <Metric label="Profit/Loss">
      <ProfitLoss
        value={profitLoss}
        percent={profitLossPercent}
        currency={baseCurrency}
      />
    </Metric>
  </DetailSection>
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton aria-hidden="true" className="h-64 w-full rounded-xl" />

            <Skeleton aria-hidden="true" className="h-64 w-full rounded-xl" />
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
          <div className="grid gap-6 lg:grid-cols-2">
            <QuoteOverview position={heldPosition} />

            <PositionValues position={heldPosition} />
          </div>

          <PerformanceChart
            portfolio={portfolio}
            symbol={heldPosition.symbol}
          />

          <AssetTransactions
            portfolio={portfolio}
            symbol={heldPosition.symbol}
          />
        </>
      )}
    </div>
  );
};
