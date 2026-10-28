import { Prisma } from '@prisma/client';

import { DecimalColumn } from '@/config/Constants';

import type {
  MarketDataFailure,
  ObservedPrice,
  QuoteLookup
} from './MarketDataProvider';
import type { Position, Transaction } from './models';

export type HeldPosition = Pick<Position, 'quantity' | 'investedValue'> & {
  ledgerCurrency: Transaction['currency'] | null;
};

export type PositionValuation =
  | {
      outcome: 'valued';
      quote: ObservedPrice;
      marketValue: string;
      profitLoss?: string;
      profitLossPercent?: string;
    }
  | MarketDataFailure;

/**
 * No operation of a valuation rounds at this precision. A product of a
 * quantity, a price and an exchange rate, each fitting the columns, has at most
 * 3 × PRECISION significant digits, and a sum of fewer than 10^PRECISION such
 * products at most PRECISION more; a quotient of the difference of two such
 * sums, truncated at the column scale, by a divisor of at least one unit of the
 * scale keeps every digit down to the column scale when rounded towards zero.
 */
const VALUATION_ARITHMETIC_PRECISION = 4 * DecimalColumn.PRECISION;

export const ValuationDecimal = Prisma.Decimal.clone({
  precision: VALUATION_ARITHMETIC_PRECISION,
  rounding: Prisma.Decimal.ROUND_DOWN
});

export const truncateToColumnScale = (value: Prisma.Decimal) =>
  value.toDecimalPlaces(DecimalColumn.SCALE, ValuationDecimal.ROUND_DOWN);

/**
 * `marketValue` is quantity × quoted price, in the quote currency. The invested
 * value is in the ledger currency, so `profitLoss` is given only when both are
 * the same: a ledger without transactions has no currency, and different
 * currencies only add up through an exchange rate. `profitLossPercent` is
 * `profitLoss ÷ investedValue` as a fraction, absent when nothing is invested.
 * Every value is truncated towards zero at the column scale.
 */
export const valuePosition = (
  { quantity, investedValue, ledgerCurrency }: HeldPosition,
  lookup: QuoteLookup
): PositionValuation => {
  if (lookup.outcome !== 'quoted') return lookup;

  const { quote } = lookup;
  const marketValue = truncateToColumnScale(
    new ValuationDecimal(quantity).mul(quote.price)
  );

  if (ledgerCurrency !== quote.currency)
    return { outcome: 'valued', quote, marketValue: marketValue.toFixed() };

  const cost = new ValuationDecimal(investedValue);
  const profitLoss = marketValue.sub(cost);

  return {
    outcome: 'valued',
    quote,
    marketValue: marketValue.toFixed(),
    profitLoss: profitLoss.toFixed(),
    ...(!cost.isZero() && {
      profitLossPercent: truncateToColumnScale(profitLoss.div(cost)).toFixed()
    })
  };
};
