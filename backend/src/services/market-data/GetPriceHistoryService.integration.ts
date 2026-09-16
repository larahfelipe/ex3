import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { InstrumentMessages } from '@/config';
import type {
  MarketDataProvider,
  ObservedPrice,
  PriceHistoryLookup
} from '@/domain/MarketDataProvider';
import { NotFoundError } from '@/errors';
import { InstrumentRepository, MarketQuoteRepository } from '@/infra/database';
import {
  FAKE_MARKET_DATA_SOURCE,
  FakeMarketDataProvider
} from '@/test/FakeMarketDataProvider';
import { createInstrument } from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

import { GetPriceHistoryService } from './GetPriceHistoryService';

const SYMBOL = 'BTC';
const CURRENCY = 'BRL';

const NOW = new Date('2026-09-16T14:30:00.000Z');
const TODAY = new Date('2026-09-16T00:00:00.000Z');
const RANGE = {
  from: new Date('2026-09-14T00:00:00.000Z'),
  to: new Date('2026-09-17T00:00:00.000Z')
};

const marketQuoteRepository = MarketQuoteRepository.getInstance();

/** The fake needs a price per symbol; every test replaces `getHistoricalPrices` with its own. */
const marketDataProvider = new FakeMarketDataProvider({
  [SYMBOL]: [{ price: '1', currency: CURRENCY, timestamp: NOW }]
});

const getPriceHistoryService = GetPriceHistoryService.getInstance(
  InstrumentRepository.getInstance(),
  marketQuoteRepository,
  marketDataProvider,
  () => NOW
);

const closeOn = (day: string, price: string): ObservedPrice => ({
  price,
  currency: CURRENCY,
  timestamp: new Date(day),
  source: FAKE_MARKET_DATA_SOURCE
});

const answering =
  (lookup: PriceHistoryLookup): MarketDataProvider['getHistoricalPrices'] =>
  async () =>
    lookup;

const asSeries = (
  history: Awaited<ReturnType<typeof getPriceHistoryService.execute>>
) =>
  history.map(({ timestamp, price, currency, source }) => ({
    timestamp,
    price,
    currency,
    source
  }));

describe('price history', () => {
  registerIntegrationHooks();

  it('asks the provider for the whole range but the current day, and answers what it recorded', async (t) => {
    await createInstrument({ symbol: SYMBOL, currency: CURRENCY });

    const historicalPrices = t.mock.method(
      marketDataProvider,
      'getHistoricalPrices',
      answering({
        outcome: 'quoted',
        prices: [
          closeOn('2026-09-14T20:00:00.000Z', '101.5'),
          closeOn('2026-09-15T20:00:00.000Z', '102.25')
        ]
      })
    );

    const history = await getPriceHistoryService.execute({
      symbol: SYMBOL,
      ...RANGE
    });

    assert.deepEqual(historicalPrices.mock.calls[0].arguments[1], {
      from: RANGE.from,
      to: TODAY
    });
    assert.equal(historicalPrices.mock.calls[0].arguments[2], '1d');
    assert.deepEqual(asSeries(history), [
      {
        timestamp: new Date('2026-09-14T00:00:00.000Z'),
        price: '101.5',
        currency: CURRENCY,
        source: FAKE_MARKET_DATA_SOURCE
      },
      {
        timestamp: new Date('2026-09-15T00:00:00.000Z'),
        price: '102.25',
        currency: CURRENCY,
        source: FAKE_MARKET_DATA_SOURCE
      }
    ]);
  });

  it('does not ask the provider when the stored closes reach the current day', async (t) => {
    const { id: instrumentId } = await createInstrument({ symbol: SYMBOL });

    await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [
        closeOn('2026-09-14T20:00:00.000Z', '101.5'),
        closeOn('2026-09-15T20:00:00.000Z', '102.25')
      ]
    });

    const historicalPrices = t.mock.method(
      marketDataProvider,
      'getHistoricalPrices',
      answering({ outcome: 'quoted', prices: [] })
    );

    const history = await getPriceHistoryService.execute({
      symbol: SYMBOL,
      ...RANGE
    });

    assert.equal(historicalPrices.mock.calls.length, 0);
    assert.equal(history.length, 2);
  });

  it('asks only for the days missing after the newest close stored', async (t) => {
    const { id: instrumentId } = await createInstrument({ symbol: SYMBOL });

    await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [closeOn('2026-09-14T20:00:00.000Z', '101.5')]
    });

    const historicalPrices = t.mock.method(
      marketDataProvider,
      'getHistoricalPrices',
      answering({
        outcome: 'quoted',
        prices: [closeOn('2026-09-15T20:00:00.000Z', '102.25')]
      })
    );

    const history = await getPriceHistoryService.execute({
      symbol: SYMBOL,
      ...RANGE
    });

    assert.equal(historicalPrices.mock.calls.length, 1);
    assert.deepEqual(historicalPrices.mock.calls[0].arguments[1], {
      from: new Date('2026-09-15T00:00:00.000Z'),
      to: TODAY
    });
    assert.deepEqual(
      history.map(({ price }) => price),
      ['101.5', '102.25']
    );
  });

  it('answers what is stored when the provider does not respond', async (t) => {
    const { id: instrumentId } = await createInstrument({ symbol: SYMBOL });

    await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [closeOn('2026-09-14T20:00:00.000Z', '101.5')]
    });

    t.mock.method(
      marketDataProvider,
      'getHistoricalPrices',
      answering({ outcome: 'unavailable' })
    );

    const history = await getPriceHistoryService.execute({
      symbol: SYMBOL,
      ...RANGE
    });

    assert.deepEqual(
      history.map(({ price }) => price),
      ['101.5']
    );
  });

  it('refuses a symbol outside the catalog', async () => {
    await assert.rejects(
      getPriceHistoryService.execute({ symbol: 'NONE', ...RANGE }),
      new NotFoundError(InstrumentMessages.NOT_FOUND)
    );
  });
});
