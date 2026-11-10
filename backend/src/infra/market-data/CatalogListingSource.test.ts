import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';

import { InstrumentTypes } from '@/config/Constants';
import type {
  DescribedListing,
  ListingCatalog,
  ListingSource
} from '@/domain/MarketDataProvider';
import { FakeMarketDataProvider } from '@/test/FakeMarketDataProvider';

import { CatalogListingSource } from './CatalogListingSource';

const PETR4_LISTING: DescribedListing = {
  symbol: 'PETR4',
  name: 'Petróleo Brasileiro S.A.',
  type: InstrumentTypes.STOCK,
  market: 'B3',
  currency: 'BRL',
  sector: 'Energy Minerals'
};
const VALE3_LISTING: DescribedListing = {
  ...PETR4_LISTING,
  symbol: 'VALE3',
  name: 'Vale S.A.',
  sector: null
};
const AAPL_LISTING = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  type: InstrumentTypes.STOCK,
  market: 'NASDAQ',
  currency: 'USD'
};

const { sector: _sector, ...PETR4_SEARCHED } = PETR4_LISTING;

const catalogOf = (
  listings: ReadonlyArray<DescribedListing> | null
): ListingCatalog => ({
  getListings: async () =>
    listings === null
      ? { outcome: 'unavailable' }
      : {
          outcome: 'listed',
          listings: new Map(
            listings.map((listing) => [listing.symbol, listing])
          )
        }
});

const sourceWith = (t: TestContext, catalog: ListingCatalog) => {
  const provider: ListingSource = new FakeMarketDataProvider(
    {},
    {
      listings: [
        { ...AAPL_LISTING, sector: 'Technology' },
        { ...PETR4_SEARCHED, name: 'Petrobras', sector: 'Energy' }
      ]
    }
  );

  return {
    source: new CatalogListingSource(catalog, provider),
    findListings: t.mock.method(provider, 'findListings'),
    describeListing: t.mock.method(provider, 'describeListing')
  };
};

describe('CatalogListingSource', () => {
  it('answers the symbols the catalog holds from it, without a sector, and asks the provider about the rest in one search', async (t) => {
    const { source, findListings } = sourceWith(
      t,
      catalogOf([PETR4_LISTING, VALE3_LISTING])
    );

    assert.deepEqual(
      await source.findListings(
        new Map([
          ['PETR4', 'BRL'],
          ['VALE3', null],
          ['AAPL', 'USD'],
          ['XPTO3', 'BRL']
        ])
      ),
      new Map([
        ['PETR4', { outcome: 'searched', listings: [PETR4_SEARCHED] }],
        [
          'VALE3',
          {
            outcome: 'searched',
            listings: [
              { ...PETR4_SEARCHED, symbol: 'VALE3', name: 'Vale S.A.' }
            ]
          }
        ],
        ['AAPL', { outcome: 'searched', listings: [AAPL_LISTING] }],
        ['XPTO3', { outcome: 'searched', listings: [] }]
      ])
    );
    assert.equal(findListings.mock.callCount(), 1);
    assert.deepEqual(findListings.mock.calls[0].arguments, [
      new Map([
        ['AAPL', 'USD'],
        ['XPTO3', 'BRL']
      ])
    ]);
  });

  it('asks the provider nothing when the catalog holds every symbol', async (t) => {
    const { source, findListings } = sourceWith(t, catalogOf([PETR4_LISTING]));

    assert.deepEqual(
      await source.findListings(new Map([['PETR4', 'BRL']])),
      new Map([['PETR4', { outcome: 'searched', listings: [PETR4_SEARCHED] }]])
    );
    assert.equal(findListings.mock.callCount(), 0);
  });

  it('asks the provider about a symbol the catalog holds in another currency than the one asked for', async (t) => {
    const { source, findListings } = sourceWith(t, catalogOf([PETR4_LISTING]));

    assert.deepEqual(
      await source.findListings(new Map([['PETR4', 'USD']])),
      new Map([['PETR4', { outcome: 'searched', listings: [] }]])
    );
    assert.deepEqual(findListings.mock.calls[0].arguments, [
      new Map([['PETR4', 'USD']])
    ]);
  });

  it('asks the provider about every symbol while the catalog is unavailable', async (t) => {
    const { source, findListings } = sourceWith(t, catalogOf(null));
    const asked = new Map([
      ['PETR4', 'BRL'],
      ['AAPL', null]
    ]);

    assert.deepEqual(
      await source.findListings(asked),
      new Map([
        [
          'PETR4',
          {
            outcome: 'searched',
            listings: [{ ...PETR4_SEARCHED, name: 'Petrobras' }]
          }
        ],
        ['AAPL', { outcome: 'searched', listings: [AAPL_LISTING] }]
      ])
    );
    assert.deepEqual(findListings.mock.calls[0].arguments, [asked]);
  });

  it('describes a listing the catalog holds in its market and currency from it, with its sector, and any other through the provider', async (t) => {
    const { source, describeListing } = sourceWith(
      t,
      catalogOf([PETR4_LISTING])
    );

    assert.deepEqual(
      await source.describeListing({
        symbol: 'PETR4',
        market: 'B3',
        currency: 'BRL'
      }),
      { outcome: 'listed', listing: PETR4_LISTING }
    );
    assert.equal(describeListing.mock.callCount(), 0);

    assert.deepEqual(
      await source.describeListing({
        symbol: 'AAPL',
        market: 'NASDAQ',
        currency: 'USD'
      }),
      { outcome: 'listed', listing: { ...AAPL_LISTING, sector: 'Technology' } }
    );
    for (const elsewhere of [
      { market: 'NYSE', currency: 'BRL' },
      { market: 'B3', currency: 'USD' }
    ])
      assert.deepEqual(
        await source.describeListing({ symbol: 'PETR4', ...elsewhere }),
        { outcome: 'not-found' }
      );

    assert.equal(describeListing.mock.callCount(), 3);
  });

  it('describes every listing through the provider while the catalog is unavailable', async (t) => {
    const { source, describeListing } = sourceWith(t, catalogOf(null));

    assert.deepEqual(
      await source.describeListing({
        symbol: 'PETR4',
        market: 'B3',
        currency: 'BRL'
      }),
      {
        outcome: 'listed',
        listing: { ...PETR4_SEARCHED, name: 'Petrobras', sector: 'Energy' }
      }
    );
    assert.equal(describeListing.mock.callCount(), 1);
  });
});
