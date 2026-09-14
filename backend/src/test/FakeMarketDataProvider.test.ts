import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  MarketDataProvider,
  PriceInterval
} from '@/domain/MarketDataProvider';

import {
  FAKE_MARKET_DATA_SOURCE,
  FakeMarketDataProvider
} from './FakeMarketDataProvider';

const MARKET_OPEN = new Date('2026-01-05T13:00:00.000Z');
const MARKET_CLOSE = new Date('2026-01-05T20:00:00.000Z');
const NEXT_MARKET_CLOSE = new Date('2026-01-06T20:00:00.000Z');
const ONE_MILLISECOND = 1;
const DAILY: PriceInterval = '1d';

const PETR4 = { symbol: 'PETR4', market: 'B3', currency: 'BRL' };
const VALE3 = { symbol: 'VALE3', market: 'B3', currency: 'BRL' };

const observedPrice = (price: string, timestamp: Date) => ({
  price,
  currency: 'BRL',
  timestamp,
  source: FAKE_MARKET_DATA_SOURCE
});

describe('FakeMarketDataProvider', () => {
  const provider: MarketDataProvider = new FakeMarketDataProvider({
    PETR4: [
      { price: '38.5', currency: 'BRL', timestamp: NEXT_MARKET_CLOSE },
      { price: '37.1', currency: 'BRL', timestamp: MARKET_OPEN },
      { price: '37.9', currency: 'BRL', timestamp: MARKET_CLOSE }
    ]
  });

  it('quotes the latest price of each instrument, whatever the seeding order', async () => {
    assert.deepEqual(
      await provider.getQuotes([PETR4]),
      new Map([
        [
          'PETR4',
          { outcome: 'quoted', quote: observedPrice('38.5', NEXT_MARKET_CLOSE) }
        ]
      ])
    );
  });

  it('answers the prices of a range in ascending order of timestamp', async () => {
    assert.deepEqual(
      await provider.getHistoricalPrices(
        PETR4,
        {
          from: MARKET_OPEN,
          to: new Date(NEXT_MARKET_CLOSE.getTime() + ONE_MILLISECOND)
        },
        DAILY
      ),
      {
        outcome: 'quoted',
        prices: [
          observedPrice('37.1', MARKET_OPEN),
          observedPrice('37.9', MARKET_CLOSE),
          observedPrice('38.5', NEXT_MARKET_CLOSE)
        ]
      }
    );
  });

  it('includes the start of a range and excludes its end', async () => {
    assert.deepEqual(
      await provider.getHistoricalPrices(
        PETR4,
        { from: MARKET_CLOSE, to: NEXT_MARKET_CLOSE },
        DAILY
      ),
      { outcome: 'quoted', prices: [observedPrice('37.9', MARKET_CLOSE)] }
    );
  });

  it('answers no prices for an empty range', async () => {
    assert.deepEqual(
      await provider.getHistoricalPrices(
        PETR4,
        { from: MARKET_CLOSE, to: MARKET_CLOSE },
        DAILY
      ),
      { outcome: 'quoted', prices: [] }
    );
  });

  it('reports an instrument without prices as not found, next to one quoted', async () => {
    assert.deepEqual(
      await provider.getQuotes([PETR4, VALE3]),
      new Map([
        [
          'PETR4',
          { outcome: 'quoted', quote: observedPrice('38.5', NEXT_MARKET_CLOSE) }
        ],
        ['VALE3', { outcome: 'not-found' }]
      ])
    );
    assert.deepEqual(
      await provider.getHistoricalPrices(
        VALE3,
        { from: MARKET_OPEN, to: NEXT_MARKET_CLOSE },
        DAILY
      ),
      { outcome: 'not-found' }
    );
  });

  it('quotes an exchange rate seeded under the codes of its pair', async () => {
    const withRates = new FakeMarketDataProvider({
      USDBRL: [{ price: '5.41', currency: 'BRL', timestamp: MARKET_CLOSE }]
    });

    assert.deepEqual(
      await withRates.getExchangeRates(['USD', 'EUR'], 'BRL'),
      new Map([
        [
          'USD',
          { outcome: 'quoted', quote: observedPrice('5.41', MARKET_CLOSE) }
        ],
        ['EUR', { outcome: 'not-found' }]
      ])
    );
  });

  it('reports itself unavailable, even for an instrument with prices', async () => {
    const unavailableProvider: MarketDataProvider = new FakeMarketDataProvider(
      { PETR4: [{ price: '37.1', currency: 'BRL', timestamp: MARKET_OPEN }] },
      { isAvailable: false }
    );

    assert.deepEqual(
      await unavailableProvider.getQuotes([PETR4]),
      new Map([['PETR4', { outcome: 'unavailable' }]])
    );
    assert.deepEqual(
      await unavailableProvider.getHistoricalPrices(
        PETR4,
        { from: MARKET_OPEN, to: NEXT_MARKET_CLOSE },
        DAILY
      ),
      { outcome: 'unavailable' }
    );
  });
});
