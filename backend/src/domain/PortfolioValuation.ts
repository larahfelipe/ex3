import type { Prisma } from '@prisma/client';

import { SortOrderTypes } from '@/config/Constants';

import type { Quote, QuoteLookup } from './MarketDataProvider';
import type { Instrument, Portfolio, Position } from './models';
import {
  type HeldPosition,
  truncateToColumnScale,
  ValuationDecimal
} from './PositionValuation';

export type PortfolioHoldings = {
  baseCurrency: Portfolio['baseCurrency'];
  positions: ReadonlyArray<HeldPosition & Pick<Instrument, 'symbol'>>;
  quotes: ReadonlyMap<string, QuoteLookup>;
  exchangeRates: ReadonlyMap<string, QuoteLookup>;
};

export type PortfolioOverview = {
  baseCurrency: Portfolio['baseCurrency'];
  totalValue?: string;
  investedValue?: string;
  profitLoss?: string;
  profitLossPercent?: string;
  dayChange?: string;
  dayChangePercent?: string;
  quotedAt?: Date;
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

/**
 * Every total is in `baseCurrency`, each amount converted at the latest rate
 * from its own currency, so neither `profitLoss` nor `dayChange` reflects how
 * the rates moved. A total is given only when every position with units has
 * what it needs: `investedValue` the rate from the currency of a cost that is
 * not zero, `totalValue` a quote and the rate from its currency, and
 * `dayChange` also the previous close. `profitLossPercent` is a fraction of the
 * invested value and `dayChangePercent` of the value at the previous close,
 * each absent when that is zero. Totals are truncated towards zero at the
 * column scale.
 */
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

/**
 * Each listed position is valued in `baseCurrency` at the latest rate, as in
 * the overview: `marketPrice` and `marketValue` from the quote, `averageCost`
 * and the invested value from the ledger. `allocation` is the fraction of the
 * overview's `totalValue` the market value makes, absent when that total is
 * absent or zero, and `profitLossPercent` the fraction of the invested value,
 * absent when that is zero. Every value is truncated towards zero at the
 * column scale.
 */
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

/**
 * Positions without the value go last in either direction. The sort is stable,
 * so ties keep the order the positions came in.
 */
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

/**
 * Only positions with units are allocated. A group adds up exactly the
 * `marketValue` and `allocation` its positions have in
 * `valuePositionsInBaseCurrency`, and leaves either out when one of them lacks
 * it, so every breakdown adds up to the same amounts: for n positions, short of
 * `totalValue` by less than n × 10⁻¹⁸ and of 1 by less than
 * n × 10⁻¹⁸ × (1 + 1 ÷ totalValue). A position counts in the currency of its
 * quote, or of the catalog without one. Groups follow the order of their keys,
 * a null key last.
 */
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
