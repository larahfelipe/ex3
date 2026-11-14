import { IncomeTransactionTypes } from '@/config/Constants';

import type { PriceRange } from './MarketDataProvider';
import type { MarketQuote, Position } from './models';
import {
  performanceRangeOf,
  PerformanceRanges,
  type PerformanceRange
} from './PortfolioPerformance';
import { realizeProfitLoss, type LedgerEntry } from './PositionLedger';
import { truncateToColumnScale, ValuationDecimal } from './PositionValuation';
import { startOfDayInUtc } from './PriceHistory';

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
  (
    | Partial<Record<'change' | 'openedOn', never>>
    | (Record<'change', string> & Record<'openedOn', Date>)
  );

export type PriceClose = Record<'close', string> & Record<'closedOn', Date>;

export type PriceIndicators = {
  currency: MarketQuote['currency'];
  close: string;
  closedOn: Date;
  yearLow: string;
  yearHigh: string;
  changes: Array<PriceChange>;
  closes: Array<PriceClose>;
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

export const yearStartOf = (now: Date) =>
  performanceRangeOf(PerformanceRanges.ONE_YEAR, now).from;

export const indicatorClosesRangeOf = (now: Date): PriceRange => ({
  from: new Date(
    yearStartOf(now).getTime() -
      OPENING_CLOSE_LOOKBACK_DAYS * MILLISECONDS_PER_DAY
  ),
  to: startOfDayInUtc(now)
});

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
        ).toFixed(),
        openedOn: startOfDayInUtc(opening.timestamp)
      };
};

/**
 * A day observed by more than one source has more than one close (TD-028); the
 * one read is the latest, by the ascending order the closes come in.
 */
const lastClosePerDayOf = (ascending: ReadonlyArray<DailyClose>) =>
  ascending.filter(({ timestamp }, index) => {
    const next = ascending.at(index + 1);

    return next === undefined || dayOf(next.timestamp) !== dayOf(timestamp);
  });

const pricesOf = (
  closes: ReadonlyArray<DailyClose>,
  now: Date
): PriceIndicators | undefined => {
  const yearStart = yearStartOf(now).getTime();
  const dailyCloses = lastClosePerDayOf(
    closes.toSorted((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  );
  const yearCloses = dailyCloses
    .filter(({ timestamp }) => dayOf(timestamp) >= yearStart)
    .map(({ price }) => new ValuationDecimal(price));
  const latest = dailyCloses.at(-1);

  if (latest === undefined || yearCloses.length === 0) return undefined;

  const yearOpening = dailyCloses.findLastIndex(
    ({ timestamp }) => dayOf(timestamp) <= yearStart
  );

  return {
    currency: latest.currency,
    close: latest.price,
    closedOn: startOfDayInUtc(latest.timestamp),
    yearLow: ValuationDecimal.min(...yearCloses).toFixed(),
    yearHigh: ValuationDecimal.max(...yearCloses).toFixed(),
    changes: PriceChangeRanges.map((range) =>
      priceChangeOf(range, dailyCloses, latest, now)
    ),
    closes: dailyCloses
      .slice(Math.max(0, yearOpening))
      .map(({ price, timestamp }) => ({
        close: price,
        closedOn: startOfDayInUtc(timestamp)
      }))
  };
};

export const isIncome = ({ type }: LedgerEntry) =>
  Object.hasOwn(IncomeTransactionTypes, type);

export const netIncomeOf = (entries: ReadonlyArray<LedgerEntry>) =>
  truncateToColumnScale(
    entries.reduce(
      (total, { quantity, unitPrice, fees, taxes }) =>
        total.add(
          new ValuationDecimal(quantity).mul(unitPrice).sub(fees).sub(taxes)
        ),
      ZERO
    )
  );

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
