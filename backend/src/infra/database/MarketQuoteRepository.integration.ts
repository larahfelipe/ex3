import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ObservedPrice } from '@/domain/MarketDataProvider';
import { createInstrument } from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

import { MarketQuoteRepository } from './MarketQuoteRepository';
import { PrismaClient } from './PrismaClient';

const QUOTE_SOURCE = 'yahoo-finance';
const OTHER_QUOTE_SOURCE = 'fake';
const QUOTE_CURRENCY = 'BRL';

/** Two closes of consecutive trading days, each hours after the start of its day in UTC. */
const FIRST_CLOSE_AT = new Date('2026-09-14T20:00:00.000Z');
const SECOND_CLOSE_AT = new Date('2026-09-15T20:00:00.000Z');
const FIRST_DAY_IN_UTC = new Date('2026-09-14T00:00:00.000Z');
const SECOND_DAY_IN_UTC = new Date('2026-09-15T00:00:00.000Z');

const prismaClient = PrismaClient.getInstance();
const marketQuoteRepository = MarketQuoteRepository.getInstance();

const closeAt = (
  timestamp: Date,
  price: string,
  source: string = QUOTE_SOURCE
): ObservedPrice => ({ price, currency: QUOTE_CURRENCY, timestamp, source });

const storedQuotes = () =>
  prismaClient.marketQuote.findMany({
    orderBy: [{ timestamp: 'asc' }, { source: 'asc' }]
  });

describe('market quote repository', () => {
  registerIntegrationHooks();

  it('records one row per trading day, at the start of the day in UTC', async () => {
    const { id: instrumentId } = await createInstrument();

    const recorded = await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [
        closeAt(FIRST_CLOSE_AT, '101.5'),
        closeAt(SECOND_CLOSE_AT, '102.25')
      ]
    });

    const stored = await storedQuotes();

    assert.equal(recorded, 2);
    assert.deepEqual(
      stored.map(({ timestamp, currency, source, instrumentId: id }) => ({
        timestamp,
        currency,
        source,
        instrumentId: id
      })),
      [
        {
          timestamp: FIRST_DAY_IN_UTC,
          currency: QUOTE_CURRENCY,
          source: QUOTE_SOURCE,
          instrumentId
        },
        {
          timestamp: SECOND_DAY_IN_UTC,
          currency: QUOTE_CURRENCY,
          source: QUOTE_SOURCE,
          instrumentId
        }
      ]
    );
    assert.deepEqual(
      stored.map(({ price }) => price.toFixed()),
      ['101.5', '102.25']
    );
  });

  it('keeps the price first observed for a day already recorded from the source', async () => {
    const { id: instrumentId } = await createInstrument();

    await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [closeAt(FIRST_CLOSE_AT, '101.5')]
    });

    const recorded = await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [
        closeAt(new Date('2026-09-14T13:00:00.000Z'), '99.75'),
        closeAt(SECOND_CLOSE_AT, '102.25')
      ]
    });

    const stored = await storedQuotes();

    assert.equal(recorded, 1);
    assert.deepEqual(
      stored.map(({ price }) => price.toFixed()),
      ['101.5', '102.25']
    );
  });

  it('records the same day from another source as its own row', async () => {
    const { id: instrumentId } = await createInstrument();

    const recorded = await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: [
        closeAt(FIRST_CLOSE_AT, '101.5'),
        closeAt(FIRST_CLOSE_AT, '101.4', OTHER_QUOTE_SOURCE)
      ]
    });

    assert.equal(recorded, 2);
    assert.deepEqual(
      (await storedQuotes()).map(({ source }) => source),
      [OTHER_QUOTE_SOURCE, QUOTE_SOURCE]
    );
  });

  it('records nothing without prices', async () => {
    const { id: instrumentId } = await createInstrument();

    const recorded = await marketQuoteRepository.recordDailyCloses({
      instrumentId,
      prices: []
    });

    assert.equal(recorded, 0);
    assert.deepEqual(await storedQuotes(), []);
  });
});
