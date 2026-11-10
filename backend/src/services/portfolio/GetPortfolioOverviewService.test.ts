import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MarketDataStatus } from '@/domain/PortfolioValuation';
import type { LogEntry } from '@/infra/observability';

import { logValuationGaps } from './GetPortfolioOverviewService';

const PORTFOLIO_ID = '6f1c2a4e-3b5d-4c7e-8f90-1a2b3c4d5e6f';

const COMPLETE: MarketDataStatus = {
  valuedPositionCount: 2,
  missingQuotes: [],
  missingRates: [],
  isFallback: false,
  isStale: false
};

const entriesOf = (marketData: MarketDataStatus) => {
  const entries: Array<LogEntry> = [];

  logValuationGaps((entry) => entries.push(entry), PORTFOLIO_ID, 2, marketData);

  return entries;
};

describe('logValuationGaps', () => {
  it('names the missing prices and rates of a total that cannot be calculated', () => {
    assert.deepEqual(
      entriesOf({
        ...COMPLETE,
        valuedPositionCount: 0,
        missingQuotes: [{ symbol: 'VALE3', reason: 'not-found' }],
        missingRates: [{ currency: 'USD', reason: 'unavailable' }]
      }),
      [
        {
          severity: 'WARNING',
          event: 'valuation_incomplete',
          portfolioId: PORTFOLIO_ID,
          heldPositionCount: 2,
          valuedPositionCount: 0,
          missingQuotes: [{ symbol: 'VALE3', reason: 'not-found' }],
          missingRates: [{ currency: 'USD', reason: 'unavailable' }]
        }
      ]
    );
  });

  it('writes nothing while every position is valued, even from fallback or stale prices', () => {
    assert.deepEqual(entriesOf(COMPLETE), []);
    assert.deepEqual(
      entriesOf({ ...COMPLETE, isFallback: true, isStale: true }),
      []
    );
  });
});
