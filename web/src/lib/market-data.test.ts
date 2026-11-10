import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MarketDataStatus } from '@/app/api/v1/portfolio';

import { isMarketDataDegraded, isValuationIncomplete } from './market-data';

const COMPLETE: MarketDataStatus = {
  valuedPositionCount: 2,
  missingQuotes: [],
  missingRates: [],
  isFallback: false,
  isStale: false
};

describe('market data behind the totals', () => {
  it('is whole when every position is priced from a recent answer', () => {
    assert.equal(isValuationIncomplete(COMPLETE), false);
    assert.equal(isMarketDataDegraded(COMPLETE), false);
  });

  it('leaves the valuation incomplete when a price or a rate is missing', () => {
    const missingQuote: MarketDataStatus = {
      ...COMPLETE,
      missingQuotes: [{ symbol: 'PETR4.SA', reason: 'unavailable' }]
    };
    const missingRate: MarketDataStatus = {
      ...COMPLETE,
      missingRates: [{ currency: 'USD', reason: 'not-found' }]
    };

    assert.equal(isValuationIncomplete(missingQuote), true);
    assert.equal(isMarketDataDegraded(missingQuote), true);
    assert.equal(isValuationIncomplete(missingRate), true);
    assert.equal(isMarketDataDegraded(missingRate), true);
  });

  it('is degraded, though complete, when a price is a fallback or stale', () => {
    for (const marketData of [
      { ...COMPLETE, isFallback: true },
      { ...COMPLETE, isStale: true }
    ]) {
      assert.equal(isValuationIncomplete(marketData), false);
      assert.equal(isMarketDataDegraded(marketData), true);
    }
  });
});
