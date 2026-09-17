import { Prisma } from '@prisma/client';

import {
  DecimalColumn,
  IncomeTransactionTypes,
  TransactionTypes
} from '@/config/Constants';

import type { Position, Transaction } from './models';

export type LedgerEntry = Pick<
  Transaction,
  'type' | 'currency' | 'executedAt'
> &
  Record<'quantity' | 'unitPrice' | 'fees' | 'taxes', Prisma.Decimal | string> &
  Partial<Record<'sequence', bigint>>;

export type RebuiltPosition = Pick<
  Position,
  'quantity' | 'averageCost' | 'investedValue'
>;

export type LedgerRefusal =
  | { outcome: 'negative-amount' }
  | { outcome: 'currency-mismatch' }
  | { outcome: 'out-of-range' };

export type PositionRebuild =
  { outcome: 'rebuilt'; position: RebuiltPosition } | LedgerRefusal;

/**
 * No operation of a replay rounds at this precision. Every position it passes
 * through fits the columns, so a product of two column values has at most
 * 2 × PRECISION significant digits, adding the rest of a BUY's cost carries at
 * most one more, and the average cost is the integer quotient of that cost,
 * shifted by the scale, by a quantity of at least one unit of the scale.
 */
const LEDGER_ARITHMETIC_PRECISION = 2 * DecimalColumn.PRECISION + 1;

const LedgerDecimal = Prisma.Decimal.clone({
  precision: LEDGER_ARITHMETIC_PRECISION
});

const ZERO = new LedgerDecimal(0);
const COLUMN_SCALE_FACTOR = new LedgerDecimal(10).pow(DecimalColumn.SCALE);
const COLUMN_MAGNITUDE_BOUND = new LedgerDecimal(10).pow(
  DecimalColumn.PRECISION - DecimalColumn.SCALE
);

const byRecordingOrder = (a?: bigint, b?: bigint) =>
  a === undefined || b === undefined
    ? Number(a === undefined) - Number(b === undefined)
    : Number(a > b) - Number(a < b);

const byLedgerOrder = (a: LedgerEntry, b: LedgerEntry) =>
  a.executedAt.getTime() - b.executedAt.getTime() ||
  byRecordingOrder(a.sequence, b.sequence);

const exceedsColumn = (value: Prisma.Decimal) =>
  value.gte(COLUMN_MAGNITUDE_BOUND);

const truncateToColumnScale = (value: Prisma.Decimal) =>
  value.toDecimalPlaces(DecimalColumn.SCALE, LedgerDecimal.ROUND_DOWN);

/**
 * Entries are replayed by execution time, then by recording order, an entry not
 * yet recorded going after every recorded one executed at the same time, so the
 * same transactions rebuild the same position in whatever order they are given.
 * A ledger holds one currency, since costs in different currencies do not add
 * up. A BUY adds its quantity and its cost, quantity × unit price plus fees and
 * taxes, and truncates the new average cost to the column scale, and so does a
 * BONUS, priced at the cost attributed to each unit; a SELL leaves the average
 * cost unchanged, back to zero once nothing is held, and is refused when it
 * exceeds what the ledger holds at that point; income changes nothing.
 * `investedValue` is quantity × average cost, truncated to the column scale at
 * the end. A ledger passing through a position that does not fit the columns is
 * refused.
 */
export const rebuildPosition = (
  ledger: ReadonlyArray<LedgerEntry>
): PositionRebuild => {
  if (new Set(ledger.map(({ currency }) => currency)).size > 1)
    return { outcome: 'currency-mismatch' };

  let quantity = ZERO;
  let averageCost = ZERO;

  for (const entry of ledger.toSorted(byLedgerOrder)) {
    const entryQuantity = new LedgerDecimal(entry.quantity);

    if (
      entry.type === TransactionTypes.BUY ||
      entry.type === TransactionTypes.BONUS
    ) {
      const heldQuantity = quantity.add(entryQuantity);
      const totalCost = quantity
        .mul(averageCost)
        .add(entryQuantity.mul(entry.unitPrice))
        .add(entry.fees)
        .add(entry.taxes);

      averageCost = totalCost
        .mul(COLUMN_SCALE_FACTOR)
        .divToInt(heldQuantity)
        .div(COLUMN_SCALE_FACTOR);
      quantity = heldQuantity;
    } else if (entry.type === TransactionTypes.SELL) {
      if (entryQuantity.gt(quantity)) return { outcome: 'negative-amount' };

      quantity = quantity.sub(entryQuantity);
      averageCost = quantity.isZero() ? ZERO : averageCost;
    } else if (!Object.hasOwn(IncomeTransactionTypes, entry.type)) {
      throw new Error(`The ledger replay does not implement ${entry.type}`);
    }

    if ([quantity, averageCost, quantity.mul(averageCost)].some(exceedsColumn))
      return { outcome: 'out-of-range' };
  }

  return {
    outcome: 'rebuilt',
    position: {
      quantity: quantity.toFixed(),
      averageCost: averageCost.toFixed(),
      investedValue: truncateToColumnScale(quantity.mul(averageCost)).toFixed()
    }
  };
};
