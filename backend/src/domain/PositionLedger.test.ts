import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type LedgerEntry, rebuildPosition } from './PositionLedger';

const EXECUTED_AT = new Date('2026-01-05T13:00:00.000Z');
const EXECUTED_LATER = new Date('2026-01-06T13:00:00.000Z');

const COLUMN_MAX = '99999999999999999999.999999999999999999';
const COLUMN_UNIT = '0.000000000000000001';

const ledgerEntry = (
  entry: Pick<LedgerEntry, 'type' | 'quantity' | 'unitPrice'> &
    Partial<LedgerEntry>
): LedgerEntry => ({
  fees: '0',
  taxes: '0',
  currency: 'BRL',
  executedAt: EXECUTED_AT,
  ...entry
});

const permutationsOf = <T>(items: ReadonlyArray<T>): T[][] =>
  items.length <= 1
    ? [[...items]]
    : items.flatMap((item, index) =>
        permutationsOf(items.toSpliced(index, 1)).map((rest) => [item, ...rest])
      );

describe('rebuildPosition', () => {
  it('weights the average cost of BUYs, fees and taxes included', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '10',
        unitPrice: '10',
        fees: '1',
        taxes: '1',
        sequence: 1n
      }),
      ledgerEntry({
        type: 'BUY',
        quantity: '10',
        unitPrice: '20',
        sequence: 2n
      })
    ];

    assert.deepEqual(rebuildPosition(ledger), {
      outcome: 'rebuilt',
      position: {
        quantity: '20',
        averageCost: '15.1',
        investedValue: '302'
      }
    });
  });

  it('keeps the average cost on a SELL and zeroes it once nothing is held', () => {
    const bought = ledgerEntry({
      type: 'BUY',
      quantity: '10',
      unitPrice: '10',
      sequence: 1n
    });
    const partlySold = ledgerEntry({
      type: 'SELL',
      quantity: '4',
      unitPrice: '15',
      sequence: 2n
    });
    const soldOut = ledgerEntry({
      type: 'SELL',
      quantity: '6',
      unitPrice: '5',
      sequence: 3n
    });

    assert.deepEqual(rebuildPosition([bought, partlySold]), {
      outcome: 'rebuilt',
      position: {
        quantity: '6',
        averageCost: '10',
        investedValue: '60'
      }
    });
    assert.deepEqual(rebuildPosition([bought, partlySold, soldOut]), {
      outcome: 'rebuilt',
      position: {
        quantity: '0',
        averageCost: '0',
        investedValue: '0'
      }
    });
  });

  it('truncates the average cost and the invested value to the column scale', () => {
    const ledger = [
      ledgerEntry({ type: 'BUY', quantity: '3', unitPrice: '1', fees: '1' })
    ];

    assert.deepEqual(rebuildPosition(ledger), {
      outcome: 'rebuilt',
      position: {
        quantity: '3',
        averageCost: '1.333333333333333333',
        investedValue: '3.999999999999999999'
      }
    });
  });

  it('rebuilds the same position from the same transactions in any order', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '10',
        unitPrice: '10',
        sequence: 1n
      }),
      ledgerEntry({
        type: 'SELL',
        quantity: '5',
        unitPrice: '12',
        executedAt: EXECUTED_LATER,
        sequence: 2n
      }),
      ledgerEntry({
        type: 'BUY',
        quantity: '0.1',
        unitPrice: '30.5',
        fees: '0.25',
        sequence: 3n
      }),
      ledgerEntry({
        type: 'SELL',
        quantity: '0.1',
        unitPrice: '11',
        sequence: 4n
      })
    ];
    const expected = rebuildPosition(ledger);

    assert.equal(expected.outcome, 'rebuilt');
    for (const permutation of permutationsOf(ledger))
      assert.deepEqual(rebuildPosition(permutation), expected);
  });

  it('replays entries executed at the same time in recording order, an unrecorded entry last', () => {
    const buy = ledgerEntry({ type: 'BUY', quantity: '1', unitPrice: '10' });
    const sell = ledgerEntry({ type: 'SELL', quantity: '1', unitPrice: '10' });

    assert.equal(
      rebuildPosition([
        { ...sell, sequence: 1n },
        { ...buy, sequence: 2n }
      ]).outcome,
      'negative-amount'
    );
    assert.equal(
      rebuildPosition([
        { ...sell, sequence: 2n },
        { ...buy, sequence: 1n }
      ]).outcome,
      'rebuilt'
    );
    assert.equal(
      rebuildPosition([sell, { ...buy, sequence: 1n }]).outcome,
      'rebuilt'
    );
    assert.equal(
      rebuildPosition([buy, { ...sell, sequence: 1n }]).outcome,
      'negative-amount'
    );
  });

  it('refuses a SELL executed before the BUY that would cover it', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '1',
        unitPrice: '10',
        executedAt: EXECUTED_LATER,
        sequence: 1n
      }),
      ledgerEntry({
        type: 'SELL',
        quantity: '1',
        unitPrice: '10',
        sequence: 2n
      })
    ];

    assert.deepEqual(rebuildPosition(ledger), { outcome: 'negative-amount' });
  });

  it('refuses a ledger in more than one currency', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '1',
        unitPrice: '10',
        sequence: 1n
      }),
      ledgerEntry({
        type: 'BUY',
        quantity: '1',
        unitPrice: '10',
        currency: 'USD',
        sequence: 2n
      })
    ];

    assert.deepEqual(rebuildPosition(ledger), { outcome: 'currency-mismatch' });
  });

  it('refuses a ledger passing through a position beyond the columns, even if it ends within them', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: COLUMN_MAX,
        unitPrice: '1',
        sequence: 1n
      }),
      ledgerEntry({
        type: 'BUY',
        quantity: COLUMN_UNIT,
        unitPrice: '1',
        sequence: 2n
      }),
      ledgerEntry({ type: 'SELL', quantity: '1', unitPrice: '1', sequence: 3n })
    ];

    assert.deepEqual(rebuildPosition(ledger), { outcome: 'out-of-range' });
  });

  it('refuses a position whose invested value exceeds the columns while its other values fit', () => {
    const ledger = [
      ledgerEntry({
        type: 'BUY',
        quantity: '10000000000',
        unitPrice: '1',
        fees: '99999999990000000000'
      })
    ];

    assert.deepEqual(rebuildPosition(ledger), { outcome: 'out-of-range' });
  });

  it('adds a BONUS to the quantity and the cost at its attributed cost, which may be zero', () => {
    const bought = ledgerEntry({
      type: 'BUY',
      quantity: '10',
      unitPrice: '12',
      sequence: 1n
    });

    assert.deepEqual(
      rebuildPosition([
        bought,
        ledgerEntry({
          type: 'BONUS',
          quantity: '2',
          unitPrice: '0',
          sequence: 2n
        })
      ]),
      {
        outcome: 'rebuilt',
        position: { quantity: '12', averageCost: '10', investedValue: '120' }
      }
    );
    assert.deepEqual(
      rebuildPosition([
        bought,
        ledgerEntry({
          type: 'BONUS',
          quantity: '10',
          unitPrice: '6',
          sequence: 2n
        })
      ]),
      {
        outcome: 'rebuilt',
        position: { quantity: '20', averageCost: '9', investedValue: '180' }
      }
    );
  });

  it('leaves the quantity and the cost unchanged on income, whether or not anything is held', () => {
    const bought = ledgerEntry({
      type: 'BUY',
      quantity: '10',
      unitPrice: '10',
      executedAt: EXECUTED_LATER,
      sequence: 1n
    });

    for (const type of ['DIVIDEND', 'JCP', 'INTEREST'] as const) {
      const paidBeforeHolding = ledgerEntry({
        type,
        quantity: '5',
        unitPrice: '1',
        taxes: '0.75',
        sequence: 2n
      });
      const paidWhileHolding = ledgerEntry({
        type,
        quantity: '10',
        unitPrice: '1',
        fees: '1',
        executedAt: EXECUTED_LATER,
        sequence: 3n
      });

      assert.deepEqual(
        rebuildPosition([paidBeforeHolding]),
        {
          outcome: 'rebuilt',
          position: { quantity: '0', averageCost: '0', investedValue: '0' }
        },
        type
      );
      assert.deepEqual(
        rebuildPosition([bought, paidBeforeHolding, paidWhileHolding]),
        {
          outcome: 'rebuilt',
          position: { quantity: '10', averageCost: '10', investedValue: '100' }
        },
        type
      );
      assert.deepEqual(
        rebuildPosition([bought, { ...paidWhileHolding, currency: 'USD' }]),
        { outcome: 'currency-mismatch' },
        type
      );
    }
  });

  it('throws on a type the replay does not implement', () => {
    const ledger = [
      ledgerEntry({ type: 'SPLIT', quantity: '1', unitPrice: '10' })
    ];

    assert.throws(() => rebuildPosition(ledger), /does not implement SPLIT/);
  });
});
