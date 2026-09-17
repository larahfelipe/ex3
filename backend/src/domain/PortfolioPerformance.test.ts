import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TransactionTypes } from '@/config/Constants';

import {
  type DailyPrice,
  PerformanceRanges,
  performanceRangeOf,
  type PortfolioLedgerEntry,
  trackPortfolioPerformance
} from './PortfolioPerformance';

const NOW = new Date('2026-09-16T14:30:00.000Z');
const INSTRUMENT_ID = 'c0ffee00-0000-4000-8000-000000000001';

const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

const closeOn = (date: string, price: string): DailyPrice => ({
  timestamp: day(date),
  price
});

const tradeOf = (
  type: PortfolioLedgerEntry['type'],
  executedAt: string,
  quantity: string,
  unitPrice: string,
  currency = 'BRL'
): PortfolioLedgerEntry => ({
  instrumentId: INSTRUMENT_ID,
  type,
  quantity,
  unitPrice,
  fees: '0',
  taxes: '0',
  currency,
  executedAt: new Date(executedAt)
});

const quotedIn = (currency: string, closes: Array<DailyPrice>) =>
  new Map([[INSTRUMENT_ID, { symbol: 'PETR4', currency, closes }]]);

const RANGE = { from: day('2026-09-14'), to: day('2026-09-16') };

const BOUGHT_IN_BASE_CURRENCY = [
  tradeOf(TransactionTypes.BUY, '2026-09-14T13:00:00.000Z', '10', '10')
];

const BOUGHT_IN_FOREIGN_CURRENCY = [
  tradeOf(TransactionTypes.BUY, '2026-09-14T13:00:00.000Z', '2', '10', 'USD')
];

describe('performanceRangeOf', () => {
  it('goes back whole months from the start of the current day in UTC', () => {
    assert.deepEqual(performanceRangeOf(PerformanceRanges.ONE_MONTH, NOW), {
      from: day('2026-08-16'),
      to: day('2026-09-16')
    });
    assert.deepEqual(performanceRangeOf(PerformanceRanges.ONE_YEAR, NOW), {
      from: day('2025-09-16'),
      to: day('2026-09-16')
    });
  });

  it('goes back seven days for the week', () => {
    assert.deepEqual(performanceRangeOf(PerformanceRanges.ONE_WEEK, NOW), {
      from: day('2026-09-09'),
      to: day('2026-09-16')
    });
  });

  it('starts the year to date at the first day of the year', () => {
    assert.deepEqual(performanceRangeOf(PerformanceRanges.YEAR_TO_DATE, NOW), {
      from: day('2026-01-01'),
      to: day('2026-09-16')
    });
  });

  it('starts the longest range at the day the ledger begins', () => {
    assert.deepEqual(
      performanceRangeOf(
        PerformanceRanges.MAX,
        NOW,
        new Date('2026-03-05T18:45:00.000Z')
      ),
      { from: day('2026-03-05'), to: day('2026-09-16') }
    );
  });

  it('answers an empty window for the longest range of an empty ledger', () => {
    assert.deepEqual(performanceRangeOf(PerformanceRanges.MAX, NOW), {
      from: day('2026-09-16'),
      to: day('2026-09-16')
    });
  });
});

describe('trackPortfolioPerformance', () => {
  it('values the position at each daily close and returns nothing on the first day', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: BOUGHT_IN_BASE_CURRENCY,
      instruments: quotedIn('BRL', [
        closeOn('2026-09-14', '10'),
        closeOn('2026-09-15', '11')
      ]),
      ratesByCurrency: new Map()
    });

    assert.deepEqual(series, [
      {
        date: day('2026-09-14'),
        value: '100',
        investedValue: '100',
        netContribution: '100',
        twr: '0'
      },
      {
        date: day('2026-09-15'),
        value: '110',
        investedValue: '100',
        netContribution: '0',
        twr: '0.1'
      }
    ]);
  });

  it('does not count what was put in on a day as a gain of that day', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: [
        ...BOUGHT_IN_BASE_CURRENCY,
        tradeOf(TransactionTypes.BUY, '2026-09-15T13:00:00.000Z', '10', '11')
      ],
      instruments: quotedIn('BRL', [
        closeOn('2026-09-14', '10'),
        closeOn('2026-09-15', '11')
      ]),
      ratesByCurrency: new Map()
    });

    assert.deepEqual(
      series.map(({ value, netContribution, twr }) => ({
        value,
        netContribution,
        twr
      })),
      [
        { value: '100', netContribution: '100', twr: '0' },
        { value: '220', netContribution: '110', twr: '0.1' }
      ]
    );
  });

  it('counts the income paid out on a day, net of fees and taxes, as a return of that day', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: [
        ...BOUGHT_IN_BASE_CURRENCY,
        {
          ...tradeOf(
            TransactionTypes.JCP,
            '2026-09-15T13:00:00.000Z',
            '10',
            '1'
          ),
          taxes: '1'
        }
      ],
      instruments: quotedIn('BRL', [
        closeOn('2026-09-14', '10'),
        closeOn('2026-09-15', '10')
      ]),
      ratesByCurrency: new Map()
    });

    assert.deepEqual(
      series.map(({ value, netContribution, twr }) => ({
        value,
        netContribution,
        twr
      })),
      [
        { value: '100', netContribution: '100', twr: '0' },
        { value: '100', netContribution: '-9', twr: '0.09' }
      ]
    );
  });

  it('does not count the units a BONUS adds as money put in', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: [
        ...BOUGHT_IN_BASE_CURRENCY,
        tradeOf(TransactionTypes.BONUS, '2026-09-15T13:00:00.000Z', '10', '5')
      ],
      instruments: quotedIn('BRL', [
        closeOn('2026-09-14', '10'),
        closeOn('2026-09-15', '5')
      ]),
      ratesByCurrency: new Map()
    });

    assert.deepEqual(
      series.map(({ value, investedValue, netContribution, twr }) => ({
        value,
        investedValue,
        netContribution,
        twr
      })),
      [
        {
          value: '100',
          investedValue: '100',
          netContribution: '100',
          twr: '0'
        },
        { value: '100', investedValue: '150', netContribution: '0', twr: '0' }
      ]
    );
  });

  it('takes a position quoted in another currency to the base currency', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: BOUGHT_IN_FOREIGN_CURRENCY,
      instruments: quotedIn('USD', [
        closeOn('2026-09-14', '10'),
        closeOn('2026-09-15', '12')
      ]),
      ratesByCurrency: new Map([
        ['USD', [closeOn('2026-09-14', '5'), closeOn('2026-09-15', '5')]]
      ])
    });

    assert.deepEqual(
      series.map(({ value, investedValue, twr }) => ({
        value,
        investedValue,
        twr
      })),
      [
        { value: '100', investedValue: '100', twr: '0' },
        { value: '120', investedValue: '100', twr: '0.2' }
      ]
    );
  });

  it('leaves out a day whose rate to the base currency is missing', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: BOUGHT_IN_FOREIGN_CURRENCY,
      instruments: quotedIn('USD', [
        closeOn('2026-09-14', '10'),
        closeOn('2026-09-15', '12')
      ]),
      ratesByCurrency: new Map([['USD', [closeOn('2026-09-14', '5')]]])
    });

    assert.deepEqual(
      series.map(({ date }) => date),
      [day('2026-09-14')]
    );
  });

  it('leaves out a day the position has no close for', () => {
    const { series } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: BOUGHT_IN_BASE_CURRENCY,
      instruments: new Map([
        [
          INSTRUMENT_ID,
          {
            symbol: 'PETR4',
            currency: 'BRL',
            closes: [closeOn('2026-09-15', '11')]
          }
        ],
        [
          'c0ffee00-0000-4000-8000-000000000002',
          {
            symbol: 'VALE3',
            currency: 'BRL',
            closes: [closeOn('2026-09-14', '50'), closeOn('2026-09-15', '50')]
          }
        ]
      ]),
      ratesByCurrency: new Map()
    });

    assert.deepEqual(
      series.map(({ date, value }) => ({ date, value })),
      [{ date: day('2026-09-15'), value: '110' }]
    );
  });

  it('returns the benchmark over its first close of the range', () => {
    const { benchmark } = trackPortfolioPerformance({
      baseCurrency: 'BRL',
      range: RANGE,
      ledger: BOUGHT_IN_BASE_CURRENCY,
      instruments: quotedIn('BRL', [closeOn('2026-09-14', '10')]),
      ratesByCurrency: new Map(),
      benchmark: {
        symbol: 'BOVA11',
        currency: 'BRL',
        closes: [closeOn('2026-09-14', '100'), closeOn('2026-09-15', '110')]
      }
    });

    assert.deepEqual(benchmark, {
      symbol: 'BOVA11',
      currency: 'BRL',
      series: [
        { date: day('2026-09-14'), close: '100', twr: '0' },
        { date: day('2026-09-15'), close: '110', twr: '0.1' }
      ]
    });
  });

  it('answers an empty series for a portfolio with nothing quoted', () => {
    assert.deepEqual(
      trackPortfolioPerformance({
        baseCurrency: 'BRL',
        range: RANGE,
        ledger: [],
        instruments: new Map(),
        ratesByCurrency: new Map()
      }),
      { baseCurrency: 'BRL', from: RANGE.from, to: RANGE.to, series: [] }
    );
  });
});
