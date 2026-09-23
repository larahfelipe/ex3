import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type DailyClose,
  describePositionIndicators,
  indicatorClosesRangeOf
} from './PositionIndicators';
import type { LedgerEntry } from './PositionLedger';

/** A Wednesday: the one-year window starts on 2025-09-23, the year to date on 2026-01-01. */
const NOW = new Date('2026-09-23T15:00:00.000Z');

const closeOn = (instant: string, price: string): DailyClose => ({
  price,
  currency: 'BRL',
  timestamp: new Date(instant)
});

const ledgerEntry = (
  entry: Pick<LedgerEntry, 'type' | 'quantity' | 'unitPrice' | 'executedAt'> &
    Partial<LedgerEntry>
): LedgerEntry => ({
  fees: '0',
  taxes: '0',
  currency: 'BRL',
  ...entry
});

const indicatorsOf = ({
  closes = [],
  ledger = [],
  investedValue = '0'
}: Partial<Parameters<typeof describePositionIndicators>[0]>) =>
  describePositionIndicators({ now: NOW, closes, ledger, investedValue });

describe('indicatorClosesRangeOf', () => {
  it('reads the last year from two weeks before it, up to the start of the current day in UTC', () => {
    assert.deepEqual(indicatorClosesRangeOf(NOW), {
      from: new Date('2025-09-09T00:00:00.000Z'),
      to: new Date('2026-09-23T00:00:00.000Z')
    });
  });
});

describe('describePositionIndicators', () => {
  it('changes the latest close over the last close on or before the first day of each window, and ranges it over the year', () => {
    const closes = [
      closeOn('2025-09-20T20:00:00.000Z', '60'),
      closeOn('2025-12-31T20:00:00.000Z', '100'),
      closeOn('2026-02-10T20:00:00.000Z', '70'),
      closeOn('2026-03-23T20:00:00.000Z', '90'),
      closeOn('2026-06-20T20:00:00.000Z', '120'),
      closeOn('2026-08-23T20:00:00.000Z', '125'),
      closeOn('2026-09-22T20:00:00.000Z', '150')
    ];

    assert.deepEqual(indicatorsOf({ closes: closes.toReversed() }), {
      prices: {
        currency: 'BRL',
        close: '150',
        closedOn: new Date('2026-09-22T00:00:00.000Z'),
        yearLow: '70',
        yearHigh: '150',
        changes: [
          { range: '1M', change: '0.2' },
          { range: '3M', change: '0.25' },
          { range: '6M', change: '0.666666666666666666' },
          { range: 'YTD', change: '0.5' },
          { range: '1Y', change: '1.5' }
        ]
      }
    });
  });

  it('leaves out the change of a window the history does not reach back to', () => {
    const closes = [
      closeOn('2026-07-01T20:00:00.000Z', '40'),
      closeOn('2026-09-22T20:00:00.000Z', '50')
    ];

    assert.deepEqual(indicatorsOf({ closes }).prices?.changes, [
      { range: '1M', change: '0.25' },
      { range: '3M' },
      { range: '6M' },
      { range: 'YTD' },
      { range: '1Y' }
    ]);
  });

  it('leaves out the change of a window the latest close does not reach into, or opened at zero', () => {
    const closes = [
      closeOn('2026-03-01T20:00:00.000Z', '0'),
      closeOn('2026-08-20T20:00:00.000Z', '12')
    ];

    assert.deepEqual(indicatorsOf({ closes }).prices?.changes, [
      { range: '1M' },
      { range: '3M' },
      { range: '6M' },
      { range: 'YTD' },
      { range: '1Y' }
    ]);
  });

  it('gives no price indicators without a close in the last year', () => {
    assert.deepEqual(indicatorsOf({}), {});
    assert.deepEqual(
      indicatorsOf({ closes: [closeOn('2025-09-15T20:00:00.000Z', '10')] }),
      {}
    );
  });

  it('realizes each SELL against the average cost it sold at, and nets income of fees and taxes', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '10',
        unitPrice: '10',
        fees: '1',
        executedAt: new Date('2025-03-10T13:00:00.000Z')
      }),
      ledgerEntry({
        type: 'DIVIDEND',
        quantity: '10',
        unitPrice: '0.5',
        executedAt: new Date('2025-06-01T13:00:00.000Z')
      }),
      ledgerEntry({
        type: 'SELL',
        quantity: '4',
        unitPrice: '15',
        fees: '2',
        executedAt: new Date('2026-02-02T13:00:00.000Z')
      }),
      ledgerEntry({
        type: 'JCP',
        quantity: '6',
        unitPrice: '1',
        taxes: '0.15',
        executedAt: new Date('2026-05-04T13:00:00.000Z')
      })
    ];

    assert.deepEqual(
      indicatorsOf({ ledger: ledger.toReversed(), investedValue: '60.6' }),
      {
        returns: {
          currency: 'BRL',
          since: new Date('2025-03-10T13:00:00.000Z'),
          realizedProfitLoss: '17.6',
          income: '10.85',
          trailingIncome: '5.85',
          yieldOnCost: '0.096534653465346534'
        }
      }
    );
  });

  it('realizes a loss and leaves out the yield on cost once nothing is invested', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '3',
        unitPrice: '10',
        executedAt: new Date('2026-01-05T13:00:00.000Z')
      }),
      ledgerEntry({
        type: 'SELL',
        quantity: '3',
        unitPrice: '7',
        taxes: '0.3',
        executedAt: new Date('2026-04-06T13:00:00.000Z')
      })
    ];

    assert.deepEqual(indicatorsOf({ ledger }), {
      returns: {
        currency: 'BRL',
        since: new Date('2026-01-05T13:00:00.000Z'),
        realizedProfitLoss: '-9.3',
        income: '0',
        trailingIncome: '0'
      }
    });
  });

  it('throws on a stored ledger that does not replay', () => {
    const ledger = [
      ledgerEntry({
        type: 'SELL',
        quantity: '1',
        unitPrice: '10',
        executedAt: new Date('2026-01-05T13:00:00.000Z')
      })
    ];

    assert.throws(() => indicatorsOf({ ledger }), /negative-amount/);
  });
});
