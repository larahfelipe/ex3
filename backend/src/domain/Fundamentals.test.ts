import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeFundamentals, fundamentalMetricsOf } from './Fundamentals';

describe('fundamentalMetricsOf', () => {
  it('reads a stock by every metric, valuation first', () => {
    assert.deepEqual(fundamentalMetricsOf('STOCK'), [
      'priceToEarnings',
      'dividendYield',
      'returnOnEquity',
      'profitMargin',
      'debtToEquity',
      'revenueGrowth',
      'earningsGrowth',
      'freeCashFlow'
    ]);
  });

  it('reads a real estate trust without the metrics its depreciation distorts, and a fund by its yield alone', () => {
    assert.deepEqual(fundamentalMetricsOf('REIT'), [
      'dividendYield',
      'debtToEquity',
      'revenueGrowth'
    ]);
    assert.deepEqual(fundamentalMetricsOf('ETF'), ['dividendYield']);
    assert.deepEqual(fundamentalMetricsOf('FUND'), ['dividendYield']);
  });

  it('reads no metric of a class without a company behind it', () => {
    for (const type of ['CRYPTO', 'BOND', 'TREASURY', 'CASH', 'OTHER'] as const)
      assert.deepEqual(fundamentalMetricsOf(type), []);
  });
});

describe('describeFundamentals', () => {
  it('answers one figure per metric in the order given, valueless where the source reports none', () => {
    assert.deepEqual(
      describeFundamentals(
        ['priceToEarnings', 'dividendYield', 'freeCashFlow', 'debtToEquity'],
        {
          dividendYield: '0.0612',
          freeCashFlow: { amount: '9500000000', currency: 'USD' },
          returnOnEquity: '0.25'
        },
        'yahoo-finance'
      ),
      {
        outcome: 'reported',
        source: 'yahoo-finance',
        figures: [
          { metric: 'priceToEarnings' },
          { metric: 'dividendYield', value: '0.0612' },
          { metric: 'freeCashFlow', value: '9500000000', currency: 'USD' },
          { metric: 'debtToEquity' }
        ]
      }
    );
  });
});
