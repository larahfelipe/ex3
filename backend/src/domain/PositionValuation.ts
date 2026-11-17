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

const VALUATION_ARITHMETIC_PRECISION = 4 * DecimalColumn.PRECISION;

export const ValuationDecimal = Prisma.Decimal.clone({
  precision: VALUATION_ARITHMETIC_PRECISION,
  rounding: Prisma.Decimal.ROUND_DOWN
});

export const truncateToColumnScale = (value: Prisma.Decimal) =>
  value.toDecimalPlaces(DecimalColumn.SCALE, ValuationDecimal.ROUND_DOWN);

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
