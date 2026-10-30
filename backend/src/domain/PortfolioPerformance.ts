import type { Prisma } from '@prisma/client';

import { TransactionTypes } from '@/config/Constants';

import type { PriceRange } from './MarketDataProvider';
import type { Instrument, Portfolio, Transaction } from './models';
import { rebuildPosition, type LedgerEntry } from './PositionLedger';
import { truncateToColumnScale, ValuationDecimal } from './PositionValuation';
import { startOfDayInUtc } from './PriceHistory';

const MILLISECONDS_PER_DAY = 86_400_000;

export type PortfolioLedgerEntry = LedgerEntry &
  Pick<Transaction, 'instrumentId'>;

export type DailyPrice = Record<'timestamp', Date> & Record<'price', string>;

export type QuotedInstrument = Pick<Instrument, 'symbol' | 'currency'> &
  Record<'closes', ReadonlyArray<DailyPrice>>;

export type QuotedBenchmark = QuotedInstrument & Pick<Instrument, 'name'>;

export type PerformanceHoldings = {
  baseCurrency: Portfolio['baseCurrency'];
  range: PriceRange;
  ledger: ReadonlyArray<PortfolioLedgerEntry>;
  instruments: ReadonlyMap<string, QuotedInstrument>;
  ratesByCurrency: ReadonlyMap<string, ReadonlyArray<DailyPrice>>;
  benchmark?: QuotedBenchmark;
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

export type PerformanceBenchmark = Pick<
  Instrument,
  'symbol' | 'name' | 'currency'
> &
  Record<'series', Array<BenchmarkPoint>>;

export type PerformanceSummary = Record<
  'valueChange' | 'netContribution' | 'twr',
  string
> &
  Partial<Record<'valueChangePercent', string>>;

export type PortfolioPerformance = {
  baseCurrency: Portfolio['baseCurrency'];
  from: Date;
  to: Date;
  series: Array<PerformancePoint>;
  summary?: PerformanceSummary;
  benchmark?: PerformanceBenchmark;
};

export const PerformanceRanges = {
  ONE_WEEK: '1W',
  ONE_MONTH: '1M',
  THREE_MONTHS: '3M',
  SIX_MONTHS: '6M',
  ONE_YEAR: '1Y',
  YEAR_TO_DATE: 'YTD',
  MAX: 'MAX'
} as const;

export type PerformanceRange =
  (typeof PerformanceRanges)[keyof typeof PerformanceRanges];

const WINDOW_BACK: ReadonlyMap<
  PerformanceRange,
  Record<'months' | 'days', number>
> = new Map([
  [PerformanceRanges.ONE_WEEK, { months: 0, days: 7 }],
  [PerformanceRanges.ONE_MONTH, { months: 1, days: 0 }],
  [PerformanceRanges.THREE_MONTHS, { months: 3, days: 0 }],
  [PerformanceRanges.SIX_MONTHS, { months: 6, days: 0 }],
  [PerformanceRanges.ONE_YEAR, { months: 12, days: 0 }]
]);

const ONE = new ValuationDecimal(1);

/**
 * How far back a benchmark close or rate still stands for a day it lacks: its
 * market may be closed on a day the portfolio's markets trade.
 */
export const BENCHMARK_CARRY_DAYS = 7;

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
  const back = WINDOW_BACK.get(range);

  if (back !== undefined)
    return {
      from: new Date(
        Date.UTC(
          to.getUTCFullYear(),
          to.getUTCMonth() - back.months,
          to.getUTCDate() - back.days
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

/** The window a benchmark's closes and rates are read over, so the carry reaches before it. */
export const benchmarkRangeOf = ({ from, to }: PriceRange): PriceRange => ({
  from: new Date(from.getTime() - BENCHMARK_CARRY_DAYS * MILLISECONDS_PER_DAY),
  to
});

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

  if (type === TransactionTypes.BUY) return traded.add(charges);
  if (type === TransactionTypes.BONUS) return charges;

  return traded.sub(charges).neg();
};

/** The latest price on or before each of the ascending `days`, within the carry. */
const carriedPricesOf = (
  prices: ReadonlyArray<DailyPrice>,
  days: ReadonlyArray<number>
): Array<string | undefined> => {
  const byDay = prices
    .map(({ timestamp, price }) => ({
      day: startOfDayInUtc(timestamp).getTime(),
      price
    }))
    .toSorted((a, b) => a.day - b.day);
  const carry = BENCHMARK_CARRY_DAYS * MILLISECONDS_PER_DAY;
  let next = 0;
  let latest: (typeof byDay)[number] | undefined;

  return days.map((day) => {
    while (next < byDay.length && byDay[next].day <= day)
      latest = byDay[next++];

    return latest !== undefined && day - latest.day <= carry
      ? latest.price
      : undefined;
  });
};

/**
 * The benchmark's price return in the base currency, on the portfolio's own
 * points: its close times its rate to the base currency, each the latest within
 * the carry, over the same on the portfolio's first point. Without both on that
 * first point there is no common start, and the series is empty; a later point
 * without them is left out.
 */
const benchmarkReturnsOf = (
  { closes, currency }: QuotedInstrument,
  baseCurrency: string,
  ratesByCurrency: ReadonlyMap<string, ReadonlyArray<DailyPrice>>,
  days: ReadonlyArray<number>
): Array<BenchmarkPoint> => {
  const carriedCloses = carriedPricesOf(closes, days);
  const carriedRates =
    currency === baseCurrency
      ? days.map(() => '1')
      : carriedPricesOf(
          (currency !== null && ratesByCurrency.get(currency)) || [],
          days
        );

  const valued = days.map((day, index) => {
    const close = carriedCloses[index];
    const rate = carriedRates[index];

    return close === undefined || rate === undefined
      ? null
      : { day, close, value: new ValuationDecimal(close).mul(rate) };
  });
  const opening = valued.at(0);

  if (!opening || opening.value.isZero()) return [];

  return valued.flatMap((point) =>
    point === null
      ? []
      : [
          {
            date: new Date(point.day),
            close: point.close,
            twr: truncateToColumnScale(
              point.value.div(opening.value).sub(ONE)
            ).toFixed()
          }
        ]
  );
};

const summaryOf = (
  series: ReadonlyArray<PerformancePoint>
): PerformanceSummary | undefined => {
  const [first, ...rest] = series;
  const last = series.at(-1);

  if (first === undefined || last === undefined) return undefined;

  const opening = new ValuationDecimal(first.value);
  const valueChange = new ValuationDecimal(last.value).sub(opening);

  return {
    valueChange: truncateToColumnScale(valueChange).toFixed(),
    ...(!opening.isZero() && {
      valueChangePercent: truncateToColumnScale(
        valueChange.div(opening)
      ).toFixed()
    }),
    netContribution: truncateToColumnScale(
      rest.reduce(
        (sum, { netContribution }) => sum.add(netContribution),
        new ValuationDecimal(0)
      )
    ).toFixed(),
    twr: last.twr
  };
};

/**
 * The portfolio valued at the close of each trading day of the range, in
 * `baseCurrency`, and what it returned. A day is a point only when every
 * position held that day, and every transaction executed since the previous
 * point, has a close and a rate to the base currency: a partial day would
 * answer a smaller portfolio as if it had lost value. Positions are replayed
 * from the ledger at each day, so a transaction recorded retroactively moves
 * the whole series it precedes.
 *
 * `netContribution` is the money put in or taken out since the previous point,
 * or since the start of the range for the first one, at the point's rates, so
 * a transaction executed on a day left out, or on a day without trading, still
 * counts once and never as a gain.
 *
 * `twr` is the time-weighted return accumulated from the first point, chaining
 * each point's `(value − netContribution) ÷ previous value`. A gap in the days
 * makes the next return span the gap. Every amount is truncated towards zero
 * at the column scale.
 *
 * `summary` spans the first point to the last: the change in value, which
 * includes the money put in or taken out after the first point, that money,
 * and the return over the period. The change is a fraction of the first value
 * only when that value is not zero.
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

  const valuationOn = (day: number, flowsSince: number) => {
    const closedAt = day + MILLISECONDS_PER_DAY;
    const upToDay = ledger.filter(
      ({ executedAt }) => executedAt.getTime() < closedAt
    );
    const netContribution = contributionOn(
      day,
      upToDay.filter(({ executedAt }) => executedAt.getTime() >= flowsSince)
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
  let flowsSince = range.from.getTime();
  let growth = ONE;

  for (const day of tradingDaysOf(
    [...instruments.values()].map(({ closes }) => closes)
  )) {
    const valuation = valuationOn(day, flowsSince);

    if (valuation === null) continue;

    const { value, investedValue, netContribution } = valuation;

    growth =
      previousValue === null || previousValue.isZero()
        ? growth
        : growth.mul(value.sub(netContribution).div(previousValue));
    previousValue = value;
    flowsSince = day + MILLISECONDS_PER_DAY;

    series.push({
      date: new Date(day),
      value: truncateToColumnScale(value).toFixed(),
      investedValue: truncateToColumnScale(investedValue).toFixed(),
      netContribution: truncateToColumnScale(netContribution).toFixed(),
      twr: truncateToColumnScale(growth.sub(ONE)).toFixed()
    });
  }

  const summary = summaryOf(series);

  return {
    baseCurrency,
    from: range.from,
    to: range.to,
    series,
    ...(summary && { summary }),
    ...(benchmark && {
      benchmark: {
        symbol: benchmark.symbol,
        name: benchmark.name,
        currency: benchmark.currency,
        series: benchmarkReturnsOf(
          benchmark,
          baseCurrency,
          ratesByCurrency,
          series.map(({ date }) => date.getTime())
        )
      }
    })
  };
};
