import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstrumentScopes,
  InstrumentTypes,
  MarketQuoteCurrencies,
  Markets
} from '@/config/Constants';

import {
  INSTRUMENT_REGISTRATION_OPTIONS,
  isQuotedCurrencyOf,
  toVisibleInstrument
} from './InstrumentCatalog';
import type { Instrument } from './models';

const REGISTERED_AT = new Date('2026-09-21T12:00:00.000Z');

const CATALOG_INSTRUMENT: Instrument = {
  id: '6f1c2d4e-8a1b-4c3d-9e5f-7a8b9c0d1e2f',
  symbol: 'PETR4',
  name: 'Petrobras PN',
  type: InstrumentTypes.STOCK,
  market: Markets.B3,
  currency: 'BRL',
  sector: null,
  country: 'BR',
  ownerId: null,
  createdAt: REGISTERED_AT,
  updatedAt: REGISTERED_AT
};

describe('toVisibleInstrument', () => {
  it('tells a catalog instrument from a private one and never exposes the owner', () => {
    const catalog = toVisibleInstrument(CATALOG_INSTRUMENT);
    const owned = toVisibleInstrument({
      ...CATALOG_INSTRUMENT,
      ownerId: '0d5c8f3a-2b7e-4f19-a6c4-3e9d1b2a7f80'
    });

    assert.equal(catalog.scope, InstrumentScopes.CATALOG);
    assert.equal(owned.scope, InstrumentScopes.PRIVATE);
    assert.equal(Object.hasOwn(catalog, 'ownerId'), false);
    assert.equal(Object.hasOwn(owned, 'ownerId'), false);
  });
});

describe('isQuotedCurrencyOf', () => {
  it('accepts the currency a market quotes in and refuses any other', () => {
    assert.equal(isQuotedCurrencyOf({ market: 'B3', currency: 'BRL' }), true);
    assert.equal(isQuotedCurrencyOf({ market: 'NYSE', currency: 'USD' }), true);
    assert.equal(isQuotedCurrencyOf({ market: 'B3', currency: 'USD' }), false);
    assert.equal(
      isQuotedCurrencyOf({ market: 'NASDAQ', currency: 'BRL' }),
      false
    );
  });

  it('accepts any currency where the pair names it', () => {
    for (const currency of ['USD', 'BRL', 'EUR'])
      assert.equal(isQuotedCurrencyOf({ market: 'CRYPTO', currency }), true);
  });

  it('constrains nothing without both attributes or for a market it does not know', () => {
    assert.equal(isQuotedCurrencyOf({ market: null, currency: 'USD' }), true);
    assert.equal(isQuotedCurrencyOf({ market: 'B3', currency: null }), true);
    assert.equal(isQuotedCurrencyOf({ market: 'LSE', currency: 'GBP' }), true);
  });
});

describe('INSTRUMENT_REGISTRATION_OPTIONS', () => {
  it('offers every instrument type and every quotable market with its currency', () => {
    assert.deepEqual(
      INSTRUMENT_REGISTRATION_OPTIONS.types,
      Object.keys(InstrumentTypes)
    );
    assert.deepEqual(
      INSTRUMENT_REGISTRATION_OPTIONS.markets,
      Object.entries(MarketQuoteCurrencies).map(([market, currency]) => ({
        market,
        currency
      }))
    );
  });
});
