import type { Prisma } from '@prisma/client';

import { TransactionTypes } from '@/config/Constants';

import type { PriceRange } from './MarketDataProvider';
import type { Instrument, Portfolio, Transaction } from './models';
import { type LedgerEntry, rebuildPosition } from './PositionLedger';
import { truncateToColumnScale, ValuationDecimal } from './PositionValuation';
import { startOfDayInUtc } from './PriceHistory';

const MILLISECONDS_PER_DAY = 86_400_000;

export type PortfolioLedgerEntry = LedgerEntry &
  Pick<Transaction, 'instrumentId'>;

export type DailyPrice = Record<'timestamp', Date> & Record<'price', string>;

export type QuotedInstrument = Pick<Instrument, 'symbol' | 'currency'> &
  Record<'closes', ReadonlyArray<DailyPrice>>;

export type PerformanceHoldings = {
  baseCurrency: Portfolio['baseCurrency'];
  range: PriceRange;
  ledger: ReadonlyArray<PortfolioLedgerEntry>;
  instruments: ReadonlyMap<string, QuotedInstrument>;
  ratesByCurrency: ReadonlyMap<string, ReadonlyArray<DailyPrice>>;
  benchmark?: QuotedInstrument;
};

export type PerformancePoint = {
  date: Date;
  value: string;
  investedValue: string;
  netContribution: string;
  twr: string;
};

export type BenchmarkPoint = {
  date: Date;
  close: string;
  twr: string;
};

export type PerformanceBenchmark = Pick<Instrument, 'symbol' | 'currency'> &
  Record<'series', Array<BenchmarkPoint>>;

export type PortfolioPerformance = {
  baseCurrency: Portfolio['baseCurrency'];
  from: Date;
  to: Date;
  series: Array<PerformancePoint>;
  benchmark?: PerformanceBenchmark;
};

export const PerformanceRanges = {
  ONE_MONTH: '1M',
  THREE_MONTHS: '3M',
  SIX_MONTHS: '6M',
  ONE_YEAR: '1Y',
  YEAR_TO_DATE: 'YTD',
  MAX: 'MAX'
} as const;

export type PerformanceRange =
  (typeof PerformanceRanges)[keyof typeof PerformanceRanges];

const MONTHS_BACK: ReadonlyMap<PerformanceRange, number> = new Map([
  [PerformanceRanges.ONE_MONTH, 1],
  [PerformanceRanges.THREE_MONTHS, 3],
  [PerformanceRanges.SIX_MONTHS, 6],
  [PerformanceRanges.ONE_YEAR, 12]
]);

const ONE = new ValuationDecimal(1);

/**
 * Every window ends at the start of the current day in UTC, the first day with
 * no close yet, and starts at the start of a day as well, so the same range
 * asked twice in a day answers the same days whatever timezone the caller is
 * in. `MAX` starts at `since`, the day the portfolio's ledger begins, and is an
 * empty window while there is none.
 */
export const performanceRangeOf = (
  range: PerformanceRange,
  now: Date,
  since?: Date
): PriceRange => {
  const to = startOfDayInUtc(now);
  const months = MONTHS_BACK.get(range);

  if (months !== undefined)
    return {
      from: new Date(
        Date.UTC(
          to.getUTCFullYear(),
          to.getUTCMonth() - months,
          to.getUTCDate()
        )
      ),
      to
    };

  return {
    from:
      range === PerformanceRanges.YEAR_TO_DATE
        ? new Date(Date.UTC(to.getUTCFullYear(), 0, 1))
        : startOfDayInUtc(since ?? to),
    to
  };
};

const priceByDayOf = (prices: ReadonlyArray<DailyPrice>) =>
  new Map(
    prices.map(({ timestamp, price }) => [
      startOfDayInUtc(timestamp).getTime(),
      price
    ])
  );

const tradingDaysOf = (series: ReadonlyArray<ReadonlyArray<DailyPrice>>) =>
  [
    ...new Set(
      series.flatMap((prices) =>
        prices.map(({ timestamp }) => startOfDayInUtc(timestamp).getTime())
      )
    )
  ].toSorted((a, b) => a - b);

const cashFlowOf = ({
  type,
  quantity,
  unitPrice,
  fees,
  taxes
}: LedgerEntry) => {
  const traded = new ValuationDecimal(quantity).mul(unitPrice);
  const charges = new ValuationDecimal(fees).add(taxes);

  return type === TransactionTypes.BUY
    ? traded.add(charges)
    : traded.sub(charges).neg();
};

const returnsOf = (
  closes: ReadonlyArray<DailyPrice>
): Array<BenchmarkPoint> => {
  const [first] = closes;

  if (first === undefined) return [];

  const opening = new ValuationDecimal(first.price);

  return opening.isZero()
    ? []
    : closes.map(({ timestamp, price }) => ({
        date: startOfDayInUtc(timestamp),
        close: price,
        twr: truncateToColumnScale(
          new ValuationDecimal(price).div(opening).sub(ONE)
        ).toFixed()
      }));
};

/**
 * The portfolio valued at the close of each trading day of the range, in
 * `baseCurrency`, and what it returned. A day is a point only when every
 * position held that day, and every transaction executed on it, has a close and
 * a rate to the base currency: a partial day would answer a smaller portfolio
 * as if it had lost value. Positions are replayed from the ledger at each day,
 * so a transaction recorded retroactively moves the whole series it precedes.
 *
 * `twr` is the time-weighted return accumulated from the first point, chaining
 * each day's `(value − netContribution) ÷ previous value`, so money put in or
 * taken out on a day does not count as a gain and the series compares with the
 * benchmark, whose `twr` is its close over its first close in the range. A gap
 * in the days makes the next return span the gap. Every amount is truncated
 * towards zero at the column scale.
 */
export const trackPortfolioPerformance = ({
  baseCurrency,
  range,
  ledger,
  instruments,
  ratesByCurrency,
  benchmark
}: PerformanceHoldings): PortfolioPerformance => {
  const zero = new ValuationDecimal(0);
  const nothingHeld = { value: zero, investedValue: zero };

  const closesByInstrument = new Map(
    [...instruments].map(([instrumentId, { closes }]) => [
      instrumentId,
      priceByDayOf(closes)
    ])
  );
  const ratesByDay = new Map(
    [...ratesByCurrency].map(([currency, rates]) => [
      currency,
      priceByDayOf(rates)
    ])
  );

  const rateOn = (day: number, currency: string | null) => {
    if (currency === baseCurrency) return ONE;
    if (currency === null) return null;

    const rate = ratesByDay.get(currency)?.get(day);

    return rate === undefined ? null : new ValuationDecimal(rate);
  };

  const holdingOn = (
    day: number,
    instrumentId: string,
    entries: ReadonlyArray<PortfolioLedgerEntry>
  ) => {
    const [held] = entries;

    if (held === undefined) return nothingHeld;

    const rebuild = rebuildPosition(entries);

    if (rebuild.outcome !== 'rebuilt') return null;

    const quantity = new ValuationDecimal(rebuild.position.quantity);

    if (quantity.isZero()) return nothingHeld;

    const close = closesByInstrument.get(instrumentId)?.get(day);
    const quoteRate = rateOn(
      day,
      instruments.get(instrumentId)?.currency ?? null
    );
    const ledgerRate = rateOn(day, held.currency);

    if (close === undefined || quoteRate === null || ledgerRate === null)
      return null;

    return {
      value: quantity.mul(close).mul(quoteRate),
      investedValue: new ValuationDecimal(rebuild.position.investedValue).mul(
        ledgerRate
      )
    };
  };

  const contributionOn = (
    day: number,
    entries: ReadonlyArray<PortfolioLedgerEntry>
  ) =>
    entries.reduce<Prisma.Decimal | null>((netContribution, entry) => {
      const rate = rateOn(day, entry.currency);

      return netContribution === null || rate === null
        ? null
        : netContribution.add(cashFlowOf(entry).mul(rate));
    }, zero);

  const instrumentIds = [
    ...new Set(ledger.map(({ instrumentId }) => instrumentId))
  ];

  const valuationOn = (day: number) => {
    const closedAt = day + MILLISECONDS_PER_DAY;
    const upToDay = ledger.filter(
      ({ executedAt }) => executedAt.getTime() < closedAt
    );
    const netContribution = contributionOn(
      day,
      upToDay.filter(({ executedAt }) => executedAt.getTime() >= day)
    );

    if (netContribution === null) return null;

    let value = zero;
    let investedValue = zero;

    for (const instrumentId of instrumentIds) {
      const holding = holdingOn(
        day,
        instrumentId,
        upToDay.filter((entry) => entry.instrumentId === instrumentId)
      );

      if (holding === null) return null;

      value = value.add(holding.value);
      investedValue = investedValue.add(holding.investedValue);
    }

    return { value, investedValue, netContribution };
  };

  const series: Array<PerformancePoint> = [];
  let previousValue: Prisma.Decimal | null = null;
  let growth = ONE;

  for (const day of tradingDaysOf(
    [...instruments.values()].map(({ closes }) => closes)
  )) {
    const valuation = valuationOn(day);

    if (valuation === null) continue;

    const { value, investedValue, netContribution } = valuation;

    growth =
      previousValue === null || previousValue.isZero()
        ? growth
        : growth.mul(value.sub(netContribution).div(previousValue));
    previousValue = value;

    series.push({
      date: new Date(day),
      value: truncateToColumnScale(value).toFixed(),
      investedValue: truncateToColumnScale(investedValue).toFixed(),
      netContribution: truncateToColumnScale(netContribution).toFixed(),
      twr: truncateToColumnScale(growth.sub(ONE)).toFixed()
    });
  }

  return {
    baseCurrency,
    from: range.from,
    to: range.to,
    series,
    ...(benchmark && {
      benchmark: {
        symbol: benchmark.symbol,
        currency: benchmark.currency,
        series: returnsOf(benchmark.closes)
      }
    })
  };
};
