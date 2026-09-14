import type { Prisma } from '@prisma/client';

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
  const { baseCurrency, positions, quotes } = holdings;
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
      })
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
