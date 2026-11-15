import type { Prisma } from '@prisma/client';

import { SortOrderTypes } from '@/config/Constants';

import type {
  MarketDataFailure,
  Quote,
  QuoteLookup
} from './MarketDataProvider';
import type { Instrument, Portfolio, Position } from './models';
import {
  truncateToColumnScale,
  ValuationDecimal,
  type HeldPosition
} from './PositionValuation';

export type PortfolioHoldings = {
  baseCurrency: Portfolio['baseCurrency'];
  positions: ReadonlyArray<HeldPosition & Pick<Instrument, 'symbol'>>;
  quotes: ReadonlyMap<string, QuoteLookup>;
  exchangeRates: ReadonlyMap<string, QuoteLookup>;
};

export type PortfolioOverview = {
  baseCurrency: Portfolio['baseCurrency'];
  heldPositionCount: number;
  totalValue?: string;
  investedValue?: string;
  profitLoss?: string;
  profitLossPercent?: string;
  dayChange?: string;
  dayChangePercent?: string;
  quotedAt?: Date;
};

type MarketDataGap = Record<'reason', MarketDataFailure['outcome']>;

export type MarketDataStatus = {
  valuedPositionCount: number;
  missingQuotes: Array<Pick<Instrument, 'symbol'> & MarketDataGap>;
  missingRates: Array<Record<'currency', string> & MarketDataGap>;
  isFallback: boolean;
  isStale: boolean;
};

export type ListedPosition = HeldPosition &
  Pick<Instrument, 'symbol' | 'name'> &
  Pick<Position, 'averageCost'>;

export type PortfolioPosition = Pick<
  ListedPosition,
  'symbol' | 'name' | 'quantity'
> & {
  baseCurrency: Portfolio['baseCurrency'];
  averageCost?: string;
  marketPrice?: string;
  marketValue?: string;
  allocation?: string;
  profitLoss?: string;
  profitLossPercent?: string;
};

export type AllocatedPosition = ListedPosition &
  Pick<Instrument, 'type' | 'sector' | 'currency'>;

export type PositionQuote = Pick<
  Quote,
  'price' | 'currency' | 'timestamp' | 'previousClose'
> & {
  dayChange?: string;
  dayChangePercent?: string;
};

export type PositionDetail = PortfolioPosition &
  Pick<Instrument, 'type' | 'market' | 'currency' | 'sector'> & {
    quote?: PositionQuote;
  };

export const PositionStatuses = {
  OPEN: 'open',
  CLOSED: 'closed'
} as const;

export type PositionStatus =
  (typeof PositionStatuses)[keyof typeof PositionStatuses];

export type PositionFilter = Partial<{
  search: string;
  type: Instrument['type'];
  status: PositionStatus;
}>;

export const PositionSortFields = {
  SYMBOL: 'symbol',
  QUANTITY: 'quantity',
  AVERAGE_COST: 'averageCost',
  MARKET_PRICE: 'marketPrice',
  MARKET_VALUE: 'marketValue',
  ALLOCATION: 'allocation',
  PROFIT_LOSS: 'profitLoss',
  PROFIT_LOSS_PERCENT: 'profitLossPercent'
} as const satisfies Record<string, keyof PortfolioPosition>;

export type PositionSortField =
  (typeof PositionSortFields)[keyof typeof PositionSortFields];

export type SortOrder = (typeof SortOrderTypes)[keyof typeof SortOrderTypes];

type AllocationShare = Pick<PortfolioPosition, 'marketValue' | 'allocation'>;

export type PortfolioAllocation = {
  baseCurrency: Portfolio['baseCurrency'];
  totalValue?: string;
  byAsset: Array<Pick<Instrument, 'symbol' | 'name'> & AllocationShare>;
  byType: Array<Pick<Instrument, 'type'> & AllocationShare>;
  bySector: Array<Pick<Instrument, 'sector'> & AllocationShare>;
  byCurrency: Array<Pick<Instrument, 'currency'> & AllocationShare>;
};

export const STALE_QUOTE_AFTER_DAYS = 4;

const MILLISECONDS_PER_DAY = 86_400_000;

export const holdsUnits = ({ quantity }: Pick<HeldPosition, 'quantity'>) =>
  !new ValuationDecimal(quantity).isZero();

export const foreignCurrenciesOf = (
  positions: ReadonlyArray<
    Pick<Instrument, 'currency'> & Pick<HeldPosition, 'ledgerCurrency'>
  >,
  baseCurrency: Portfolio['baseCurrency']
) => [
  ...new Set(
    positions
      .flatMap(({ currency, ledgerCurrency }) => [currency, ledgerCurrency])
      .filter((currency) => currency !== null)
      .filter((currency) => currency !== baseCurrency)
  )
];

const sumAtColumnScale = (amounts: ReadonlyArray<Prisma.Decimal | null>) =>
  amounts.every((amount) => amount !== null)
    ? truncateToColumnScale(
        amounts.reduce(
          (sum, amount) => sum.add(amount),
          new ValuationDecimal(0)
        )
      )
    : null;

const fractionOf = (part: Prisma.Decimal, whole: Prisma.Decimal) =>
  truncateToColumnScale(part.div(whole)).toFixed();

const convertingTo =
  ({
    baseCurrency,
    exchangeRates
  }: Pick<PortfolioHoldings, 'baseCurrency' | 'exchangeRates'>) =>
  (amount: Prisma.Decimal, currency: string | null) => {
    if (amount.isZero() || currency === baseCurrency) return amount;

    const rate = currency === null ? undefined : exchangeRates.get(currency);

    return rate?.outcome === 'quoted' ? amount.mul(rate.quote.price) : null;
  };

export const summarizePortfolio = (
  holdings: PortfolioHoldings
): PortfolioOverview => {
  const { baseCurrency, positions, quotes, exchangeRates } = holdings;
  const toBaseCurrency = convertingTo(holdings);

  const heldPositions = positions.filter(holdsUnits);

  const valuesAt = (priceOf: (quote: Quote) => string | undefined) =>
    heldPositions.map(({ symbol, quantity }) => {
      const lookup = quotes.get(symbol);

      if (lookup?.outcome !== 'quoted') return null;

      const price = priceOf(lookup.quote);

      return price === undefined
        ? null
        : toBaseCurrency(
            new ValuationDecimal(quantity).mul(price),
            lookup.quote.currency
          );
    });

  const totalValue = sumAtColumnScale(valuesAt(({ price }) => price));
  const previousValue = sumAtColumnScale(
    valuesAt(({ previousClose }) => previousClose)
  );
  const investedValue = sumAtColumnScale(
    heldPositions.map(({ investedValue: cost, ledgerCurrency }) =>
      toBaseCurrency(new ValuationDecimal(cost), ledgerCurrency)
    )
  );

  const profitLoss =
    totalValue && investedValue && totalValue.sub(investedValue);
  const dayChange =
    totalValue && previousValue && totalValue.sub(previousValue);
  const quotedAt =
    totalValue &&
    heldPositions
      .flatMap(({ symbol }) => {
        const lookup = quotes.get(symbol);

        if (lookup?.outcome !== 'quoted') return [];

        const { currency, timestamp } = lookup.quote;
        const rate =
          currency === baseCurrency ? undefined : exchangeRates.get(currency);

        return rate?.outcome === 'quoted'
          ? [timestamp, rate.quote.timestamp]
          : [timestamp];
      })
      .reduce<Date | undefined>(
        (oldest, instant) =>
          oldest === undefined || instant.getTime() < oldest.getTime()
            ? instant
            : oldest,
        undefined
      );

  return {
    baseCurrency,
    heldPositionCount: heldPositions.length,
    ...(totalValue && { totalValue: totalValue.toFixed() }),
    ...(investedValue && { investedValue: investedValue.toFixed() }),
    ...(profitLoss && { profitLoss: profitLoss.toFixed() }),
    ...(profitLoss &&
      investedValue &&
      !investedValue.isZero() && {
        profitLossPercent: fractionOf(profitLoss, investedValue)
      }),
    ...(dayChange && { dayChange: dayChange.toFixed() }),
    ...(dayChange &&
      previousValue &&
      !previousValue.isZero() && {
        dayChangePercent: fractionOf(dayChange, previousValue)
      }),
    ...(quotedAt && { quotedAt })
  };
};

export const describeMarketData = (
  { baseCurrency, positions, quotes, exchangeRates }: PortfolioHoldings,
  quotedAt: Date | undefined,
  now: Date
): MarketDataStatus => {
  const heldPositions = positions.filter(holdsUnits);
  const reasonOf = (lookup: QuoteLookup | undefined) =>
    lookup?.outcome === 'unavailable' ? lookup.outcome : 'not-found';
  const hasRate = (currency: string) =>
    currency === baseCurrency ||
    exchangeRates.get(currency)?.outcome === 'quoted';

  const quoted = heldPositions.flatMap(({ symbol }) => {
    const lookup = quotes.get(symbol);

    return lookup?.outcome === 'quoted' ? [lookup] : [];
  });
  const neededCurrencies = [
    ...new Set([
      ...quoted.map(({ quote }) => quote.currency),
      ...heldPositions
        .filter(
          ({ investedValue }) => !new ValuationDecimal(investedValue).isZero()
        )
        .flatMap(({ ledgerCurrency }) => ledgerCurrency ?? [])
    ])
  ];
  const usedRates = neededCurrencies.flatMap((currency) => {
    const lookup = exchangeRates.get(currency);

    return currency !== baseCurrency && lookup?.outcome === 'quoted'
      ? [lookup]
      : [];
  });

  return {
    valuedPositionCount: quoted.filter(({ quote }) => hasRate(quote.currency))
      .length,
    missingQuotes: heldPositions.flatMap(({ symbol }) => {
      const lookup = quotes.get(symbol);

      return lookup?.outcome === 'quoted'
        ? []
        : [{ symbol, reason: reasonOf(lookup) }];
    }),
    missingRates: neededCurrencies
      .filter((currency) => !hasRate(currency))
      .map((currency) => ({
        currency,
        reason: reasonOf(exchangeRates.get(currency))
      })),
    isFallback: [...quoted, ...usedRates].some(
      ({ isFallback }) => isFallback === true
    ),
    isStale:
      quotedAt !== undefined &&
      now.getTime() - quotedAt.getTime() >
        STALE_QUOTE_AFTER_DAYS * MILLISECONDS_PER_DAY
  };
};

export const valuePositionsInBaseCurrency = (
  holdings: PortfolioHoldings,
  listedPositions: ReadonlyArray<ListedPosition>
): Array<PortfolioPosition> => {
  const { baseCurrency, quotes } = holdings;
  const toBaseCurrency = convertingTo(holdings);
  const { totalValue } = summarizePortfolio(holdings);
  const portfolioValue =
    totalValue === undefined ? null : new ValuationDecimal(totalValue);

  const atColumnScale = (amount: Prisma.Decimal | null) =>
    amount && truncateToColumnScale(amount);

  return listedPositions.map(
    ({
      symbol,
      name,
      quantity,
      averageCost,
      investedValue,
      ledgerCurrency
    }) => {
      const lookup = quotes.get(symbol);
      const quote = lookup?.outcome === 'quoted' ? lookup.quote : null;

      const marketPrice =
        quote &&
        atColumnScale(
          toBaseCurrency(new ValuationDecimal(quote.price), quote.currency)
        );
      const marketValue =
        quote &&
        atColumnScale(
          toBaseCurrency(
            new ValuationDecimal(quantity).mul(quote.price),
            quote.currency
          )
        );
      const cost = atColumnScale(
        toBaseCurrency(new ValuationDecimal(averageCost), ledgerCurrency)
      );
      const invested = atColumnScale(
        toBaseCurrency(new ValuationDecimal(investedValue), ledgerCurrency)
      );
      const profitLoss = marketValue && invested && marketValue.sub(invested);

      return {
        symbol,
        name,
        quantity,
        baseCurrency,
        ...(cost && { averageCost: cost.toFixed() }),
        ...(marketPrice && { marketPrice: marketPrice.toFixed() }),
        ...(marketValue && { marketValue: marketValue.toFixed() }),
        ...(marketValue &&
          portfolioValue &&
          !portfolioValue.isZero() && {
            allocation: fractionOf(marketValue, portfolioValue)
          }),
        ...(profitLoss && { profitLoss: profitLoss.toFixed() }),
        ...(profitLoss &&
          invested &&
          !invested.isZero() && {
            profitLossPercent: fractionOf(profitLoss, invested)
          })
      };
    }
  );
};

export const describePosition = (
  holdings: PortfolioHoldings,
  position: AllocatedPosition & Pick<Instrument, 'market'>
): PositionDetail => {
  const [valuedPosition] = valuePositionsInBaseCurrency(holdings, [position]);
  const { type, market, currency, sector } = position;
  const lookup = holdings.quotes.get(position.symbol);
  const quote = lookup?.outcome === 'quoted' ? lookup.quote : null;

  const previousClose =
    quote?.previousClose === undefined
      ? null
      : new ValuationDecimal(quote.previousClose);
  const dayChange =
    quote &&
    previousClose &&
    truncateToColumnScale(new ValuationDecimal(quote.price).sub(previousClose));

  return {
    ...valuedPosition,
    type,
    market,
    currency,
    sector,
    ...(quote && {
      quote: {
        price: quote.price,
        currency: quote.currency,
        timestamp: quote.timestamp,
        ...(previousClose && { previousClose: quote.previousClose }),
        ...(dayChange && { dayChange: dayChange.toFixed() }),
        ...(dayChange &&
          previousClose &&
          !previousClose.isZero() && {
            dayChangePercent: fractionOf(dayChange, previousClose)
          })
      }
    })
  };
};

export const matchesPositionFilter =
  ({ search, type, status }: PositionFilter) =>
  (
    position: Pick<AllocatedPosition, 'symbol' | 'name' | 'type' | 'quantity'>
  ) => {
    const searchTerm = search?.toLowerCase();

    return (
      (searchTerm === undefined ||
        [position.symbol, position.name].some((text) =>
          text.toLowerCase().includes(searchTerm)
        )) &&
      (type === undefined || position.type === type) &&
      (status === undefined ||
        holdsUnits(position) === (status === PositionStatuses.OPEN))
    );
  };

export const sortPositionsBy = (
  positions: ReadonlyArray<PortfolioPosition>,
  sortBy: Exclude<PositionSortField, typeof PositionSortFields.SYMBOL>,
  sortOrder: SortOrder
) => {
  const direction = sortOrder === SortOrderTypes.DESCENDENT ? -1 : 1;

  return positions.toSorted((a, b) => {
    const valueA = a[sortBy];
    const valueB = b[sortBy];

    if (valueA === undefined) return valueB === undefined ? 0 : 1;
    if (valueB === undefined) return -1;

    return direction * new ValuationDecimal(valueA).cmp(valueB);
  });
};

const shareOf = (
  positions: ReadonlyArray<AllocationShare>
): AllocationShare => {
  const marketValue = sumAtColumnScale(
    positions.map(({ marketValue: value }) =>
      value === undefined ? null : new ValuationDecimal(value)
    )
  );
  const allocation = sumAtColumnScale(
    positions.map(({ allocation: share }) =>
      share === undefined ? null : new ValuationDecimal(share)
    )
  );

  return {
    ...(marketValue && { marketValue: marketValue.toFixed() }),
    ...(allocation && { allocation: allocation.toFixed() })
  };
};

const compareGroupKeys = (a: string | null, b: string | null) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  return a < b ? -1 : 1;
};

export const allocatePortfolio = (
  holdings: Omit<PortfolioHoldings, 'positions'> &
    Record<'positions', ReadonlyArray<AllocatedPosition>>
): PortfolioAllocation => {
  const { baseCurrency, positions, quotes } = holdings;
  const heldPositions = positions.filter(holdsUnits);
  const { totalValue } = summarizePortfolio(holdings);
  const valuedPositions = valuePositionsInBaseCurrency(holdings, heldPositions);

  const allocatedPositions = heldPositions.map(
    ({ symbol, type, sector, currency }, index) => {
      const lookup = quotes.get(symbol);

      return {
        type,
        sector,
        currency:
          lookup?.outcome === 'quoted' ? lookup.quote.currency : currency,
        share: valuedPositions[index]
      };
    }
  );

  const allocateBy = <Key extends string | null>(
    keyOf: (position: (typeof allocatedPositions)[number]) => Key
  ) =>
    [...Map.groupBy(allocatedPositions, keyOf)]
      .toSorted(([a], [b]) => compareGroupKeys(a, b))
      .map(
        ([key, members]) =>
          [key, shareOf(members.map(({ share }) => share))] as const
      );

  return {
    baseCurrency,
    ...(totalValue !== undefined && { totalValue }),
    byAsset: valuedPositions.map(({ symbol, name, ...share }) => ({
      symbol,
      name,
      ...shareOf([share])
    })),
    byType: allocateBy(({ type }) => type).map(([type, share]) => ({
      type,
      ...share
    })),
    bySector: allocateBy(({ sector }) => sector).map(([sector, share]) => ({
      sector,
      ...share
    })),
    byCurrency: allocateBy(({ currency }) => currency).map(
      ([currency, share]) => ({ currency, ...share })
    )
  };
};
