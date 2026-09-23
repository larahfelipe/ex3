import { IncomeTransactionTypes } from '@/config/Constants';

import type { PriceRange } from './MarketDataProvider';
import type { MarketQuote, Position } from './models';
import {
  PerformanceRanges,
  performanceRangeOf,
  type PerformanceRange
} from './PortfolioPerformance';
import { type LedgerEntry, realizeProfitLoss } from './PositionLedger';
import { truncateToColumnScale, ValuationDecimal } from './PositionValuation';
import { startOfDayInUtc } from './PriceHistory';

/**
 * How far before a window's first day a close is looked for: the day a window
 * starts on may be a weekend or a holiday, whose price is the last close before
 * it. Assumed, not measured: no market is expected to stay closed longer than
 * two weeks, twice the longest run of holidays and weekends of the markets the
 * catalog lists.
 */
const OPENING_CLOSE_LOOKBACK_DAYS = 14;

const MILLISECONDS_PER_DAY = 86_400_000;

const ONE = new ValuationDecimal(1);
const ZERO = new ValuationDecimal(0);

export const PriceChangeRanges = [
  PerformanceRanges.ONE_MONTH,
  PerformanceRanges.THREE_MONTHS,
  PerformanceRanges.SIX_MONTHS,
  PerformanceRanges.YEAR_TO_DATE,
  PerformanceRanges.ONE_YEAR
] as const satisfies ReadonlyArray<PerformanceRange>;

export type PriceChangeRange = (typeof PriceChangeRanges)[number];

export type DailyClose = Pick<MarketQuote, 'price' | 'currency' | 'timestamp'>;

export type PriceChange = Record<'range', PriceChangeRange> &
  Partial<Record<'change', string>>;

export type PriceIndicators = {
  currency: MarketQuote['currency'];
  close: string;
  closedOn: Date;
  yearLow: string;
  yearHigh: string;
  changes: Array<PriceChange>;
};

export type ReturnIndicators = {
  currency: LedgerEntry['currency'];
  since: Date;
  realizedProfitLoss: string;
  income: string;
  trailingIncome: string;
  yieldOnCost?: string;
};

export type PositionIndicators = Partial<{
  prices: PriceIndicators;
  returns: ReturnIndicators;
}>;

export type IndicatedPosition = {
  now: Date;
  closes: ReadonlyArray<DailyClose>;
  ledger: ReadonlyArray<LedgerEntry>;
  investedValue: Position['investedValue'];
};

const dayOf = (instant: Date) => startOfDayInUtc(instant).getTime();

const yearStartOf = (now: Date) =>
  performanceRangeOf(PerformanceRanges.ONE_YEAR, now).from;

/**
 * The closes the indicators read: the last year, from a close early enough to
 * price the first day of its longest window, up to the start of the current
 * day in UTC, the first day with no close yet.
 */
export const indicatorClosesRangeOf = (now: Date): PriceRange => ({
  from: new Date(
    yearStartOf(now).getTime() -
      OPENING_CLOSE_LOOKBACK_DAYS * MILLISECONDS_PER_DAY
  ),
  to: startOfDayInUtc(now)
});

/**
 * A window's change is the latest close over the close that prices its first
 * day, the last one on or before it, minus one, as a fraction. It is absent
 * when the history does not reach back to that day, the latest close is not
 * after it, or the opening close is zero.
 */
const priceChangeOf = (
  range: PriceChangeRange,
  closes: ReadonlyArray<DailyClose>,
  latest: DailyClose,
  now: Date
): PriceChange => {
  const firstDay = performanceRangeOf(range, now).from.getTime();
  const opening = closes.findLast(
    ({ timestamp }) => dayOf(timestamp) <= firstDay
  );

  if (opening === undefined || dayOf(latest.timestamp) <= firstDay)
    return { range };

  const openingPrice = new ValuationDecimal(opening.price);

  return openingPrice.isZero()
    ? { range }
    : {
        range,
        change: truncateToColumnScale(
          new ValuationDecimal(latest.price).div(openingPrice).sub(ONE)
        ).toFixed()
      };
};

/**
 * Price indicators need a close within the last year, so an instrument that no
 * longer trades has none. The yearly low and high are of daily closes, not of
 * intraday prices.
 */
const pricesOf = (
  closes: ReadonlyArray<DailyClose>,
  now: Date
): PriceIndicators | undefined => {
  const yearStart = yearStartOf(now).getTime();
  const ascending = closes.toSorted(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
  const yearCloses = ascending
    .filter(({ timestamp }) => dayOf(timestamp) >= yearStart)
    .map(({ price }) => new ValuationDecimal(price));
  const latest = ascending.at(-1);

  if (latest === undefined || yearCloses.length === 0) return undefined;

  return {
    currency: latest.currency,
    close: latest.price,
    closedOn: startOfDayInUtc(latest.timestamp),
    yearLow: ValuationDecimal.min(...yearCloses).toFixed(),
    yearHigh: ValuationDecimal.max(...yearCloses).toFixed(),
    changes: PriceChangeRanges.map((range) =>
      priceChangeOf(range, ascending, latest, now)
    )
  };
};

const isIncome = ({ type }: LedgerEntry) =>
  Object.hasOwn(IncomeTransactionTypes, type);

const netIncomeOf = (entries: ReadonlyArray<LedgerEntry>) =>
  truncateToColumnScale(
    entries.reduce(
      (total, { quantity, unitPrice, fees, taxes }) =>
        total.add(
          new ValuationDecimal(quantity).mul(unitPrice).sub(fees).sub(taxes)
        ),
      ZERO
    )
  );

/**
 * Returns need a transaction, whose currency is the ledger's. `income` is the
 * net of every DIVIDEND, JCP and INTEREST, `q · p − f − t`, and
 * `trailingIncome` that of those executed in the last year. `yieldOnCost` is
 * `trailingIncome ÷ investedValue`, absent while nothing is invested. A stored
 * ledger always replays, since every write rebuilt the position from it, so a
 * refusal is a broken invariant and not an answer.
 */
const returnsOf = (
  ledger: ReadonlyArray<LedgerEntry>,
  investedValue: Position['investedValue'],
  now: Date
): ReturnIndicators | undefined => {
  const [first, ...rest] = ledger;

  if (first === undefined) return undefined;

  const realization = realizeProfitLoss(ledger);

  if (realization.outcome !== 'realized')
    throw new Error(`A stored ledger failed to replay: ${realization.outcome}`);

  const yearStart = yearStartOf(now).getTime();
  const incomeEntries = ledger.filter(isIncome);
  const trailingIncome = netIncomeOf(
    incomeEntries.filter(({ executedAt }) => executedAt.getTime() >= yearStart)
  );
  const invested = new ValuationDecimal(investedValue);

  return {
    currency: first.currency,
    since: rest.reduce(
      (earliest, { executedAt }) =>
        executedAt.getTime() < earliest.getTime() ? executedAt : earliest,
      first.executedAt
    ),
    realizedProfitLoss: realization.realizedProfitLoss,
    income: netIncomeOf(incomeEntries).toFixed(),
    trailingIncome: trailingIncome.toFixed(),
    ...(!invested.isZero() && {
      yieldOnCost: truncateToColumnScale(trailingIncome.div(invested)).toFixed()
    })
  };
};

/** Every value is truncated towards zero at the column scale, and every change and yield is a fraction. */
export const describePositionIndicators = ({
  now,
  closes,
  ledger,
  investedValue
}: IndicatedPosition): PositionIndicators => {
  const prices = pricesOf(closes, now);
  const returns = returnsOf(ledger, investedValue, now);

  return {
    ...(prices && { prices }),
    ...(returns && { returns })
  };
};
