import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ObservedPrice, QuoteLookup } from './MarketDataProvider';
import { valuePosition } from './PositionValuation';

const OBSERVED_AT = new Date('2026-09-11T19:55:00.000Z');

/** The largest and the smallest positive values of a `DECIMAL(38,18)` column. */
const COLUMN_MAXIMUM = '99999999999999999999.999999999999999999';
const COLUMN_UNIT = '0.000000000000000001';

const observedPrice = (price: string, currency = 'USD'): ObservedPrice => ({
  price,
  currency,
  timestamp: OBSERVED_AT,
  source: 'test'
});

const quoted = (quote: ObservedPrice): QuoteLookup => ({
  outcome: 'quoted',
  quote
});

describe('valuePosition', () => {
  it('values a position at the quoted price, with its profit over the invested value', () => {
    const quote = observedPrice('64000.12');

    assert.deepEqual(
      valuePosition(
        { quantity: '2', investedValue: '100000', ledgerCurrency: 'USD' },
        quoted(quote)
      ),
      {
        outcome: 'valued',
        quote,
        marketValue: '128000.24',
        profitLoss: '28000.24',
        profitLossPercent: '0.2800024'
      }
    );
  });

  it('truncates every value towards zero at the column scale', () => {
    const quote = observedPrice('0.5');

    assert.deepEqual(
      valuePosition(
        {
          quantity: '1.000000000000000001',
          investedValue: '3',
          ledgerCurrency: 'USD'
        },
        quoted(quote)
      ),
      {
        outcome: 'valued',
        quote,
        marketValue: '0.5',
        profitLoss: '-2.5',
        profitLossPercent: '-0.833333333333333333'
      }
    );
  });

  it('keeps every digit of values at the bounds of the columns', () => {
    const doubled = observedPrice('2');
    const highest = observedPrice(COLUMN_MAXIMUM);

    assert.deepEqual(
      valuePosition(
        {
          quantity: COLUMN_MAXIMUM,
          investedValue: COLUMN_MAXIMUM,
          ledgerCurrency: 'USD'
        },
        quoted(doubled)
      ),
      {
        outcome: 'valued',
        quote: doubled,
        marketValue: '199999999999999999999.999999999999999998',
        profitLoss: COLUMN_MAXIMUM,
        profitLossPercent: '1'
      }
    );
    assert.deepEqual(
      valuePosition(
        { quantity: '1', investedValue: COLUMN_UNIT, ledgerCurrency: 'USD' },
        quoted(highest)
      ),
      {
        outcome: 'valued',
        quote: highest,
        marketValue: COLUMN_MAXIMUM,
        profitLoss: '99999999999999999999.999999999999999998',
        profitLossPercent: '99999999999999999999999999999999999998'
      }
    );
  });

  it('leaves the profit out when the ledger is in another currency than the quote', () => {
    const quote = observedPrice('49');

    assert.deepEqual(
      valuePosition(
        { quantity: '2', investedValue: '500', ledgerCurrency: 'BRL' },
        quoted(quote)
      ),
      { outcome: 'valued', quote, marketValue: '98' }
    );
  });

  it('leaves the profit out of a position without transactions', () => {
    const quote = observedPrice('49');

    assert.deepEqual(
      valuePosition(
        { quantity: '0', investedValue: '0', ledgerCurrency: null },
        quoted(quote)
      ),
      { outcome: 'valued', quote, marketValue: '0' }
    );
  });

  it('leaves the percentage out when nothing is invested', () => {
    const quote = observedPrice('49');

    assert.deepEqual(
      valuePosition(
        { quantity: '0', investedValue: '0', ledgerCurrency: 'USD' },
        quoted(quote)
      ),
      { outcome: 'valued', quote, marketValue: '0', profitLoss: '0' }
    );
  });

  it('answers a quote that could not be obtained as it came', () => {
    const failures: QuoteLookup[] = [
      { outcome: 'not-found' },
      { outcome: 'unavailable' }
    ];

    for (const lookup of failures)
      assert.deepEqual(
        valuePosition(
          { quantity: '2', investedValue: '100', ledgerCurrency: 'USD' },
          lookup
        ),
        lookup
      );
  });
});
