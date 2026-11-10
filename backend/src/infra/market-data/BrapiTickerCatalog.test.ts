import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { LogEntry } from '@/infra/observability';

import { BrapiTickerCatalog } from './BrapiTickerCatalog';

const API_KEY = 'brapi-api-key';
const NOW = Date.parse('2026-09-11T20:00:00.000Z');

/** Mirror the constants of `BrapiTickerCatalog`. */
const TICKERS_PAGE_SIZE = 2_000;
const MAX_TICKER_PAGES = 5;
const CATALOG_TIME_TO_LIVE_MS = 86_400_000;
const FAILURE_COOLDOWN_MS = 300_000;

/** Mirrors `InstrumentLimits.NAME_MAX_LENGTH`. */
const NAME_MAX_LENGTH = 120;

type CatalogCall = { url: URL; init: RequestInit };

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });

const ticker = (symbol: string, overrides: Record<string, unknown> = {}) => ({
  symbol,
  name: `${symbol} S.A.`,
  longName: `${symbol} SA Common Shares`,
  assetType: 'stock',
  subType: 'stock',
  exchange: 'B3',
  currency: 'BRL',
  sector: 'Finance',
  subsector: 'Financeiro',
  isActive: true,
  logoUrl: `https://icons.brapi.dev/icons/${symbol}.svg`,
  quote: { lastPrice: 10, changePercent: 1, volume: 1000, marketCap: 1e9 },
  ...overrides
});

const tickersPage = (results: Array<unknown>, hasNextPage = false) =>
  json({
    results,
    indexes: [],
    facets: {},
    pagination: {
      page: 1,
      limit: TICKERS_PAGE_SIZE,
      totalItems: results.length,
      totalPages: 1,
      hasNextPage
    },
    requestedAt: '2026-09-11T20:00:00.000Z',
    took: 45
  });

const stubCatalog = (
  respond: (call: CatalogCall) => Response | Promise<Response>
) => {
  const calls: Array<CatalogCall> = [];
  const logged: Array<LogEntry> = [];
  let now = NOW;

  const catalog = new BrapiTickerCatalog({
    apiKey: API_KEY,
    fetchResponse: async (input, init = {}) => {
      const call = {
        url: new URL(input instanceof Request ? input.url : input),
        init
      };

      calls.push(call);

      return respond(call);
    },
    now: () => now,
    logEntry: (entry) => logged.push(entry)
  });

  return {
    catalog,
    calls,
    logged,
    advance: (milliseconds: number) => {
      now += milliseconds;
    }
  };
};

const symbolsOf = async (catalog: BrapiTickerCatalog) => {
  const lookup = await catalog.getListings();

  return lookup.outcome === 'listed' ? [...lookup.listings.keys()] : lookup;
};

describe('BrapiTickerCatalog', () => {
  it('asks for nothing without a key', async (t) => {
    const fetchResponse = t.mock.fn(async () => tickersPage([ticker('PETR4')]));
    const catalog = new BrapiTickerCatalog({
      apiKey: undefined,
      fetchResponse
    });

    assert.deepEqual(await catalog.getListings(), { outcome: 'unavailable' });
    assert.equal(fetchResponse.mock.callCount(), 0);
  });

  it('reads every page in symbol order, one after another, with the key only in the authorization header', async () => {
    const pages = [
      tickersPage([ticker('ITUB4')], true),
      tickersPage([ticker('PETR4')], false)
    ];
    let pending = 0;
    let mostPending = 0;
    const { catalog, calls, logged } = stubCatalog(async () => {
      pending += 1;
      mostPending = Math.max(mostPending, pending);
      await new Promise((resolve) => setImmediate(resolve));
      pending -= 1;

      const page = pages.shift();

      assert.ok(page);

      return page;
    });

    assert.deepEqual(await symbolsOf(catalog), ['ITUB4', 'PETR4']);
    assert.equal(mostPending, 1);
    assert.deepEqual(
      calls.map(({ url }) => ({
        origin: url.origin,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams)
      })),
      [1, 2].map((page) => ({
        origin: 'https://brapi.dev',
        path: '/api/v2/tickers',
        query: {
          page: String(page),
          limit: String(TICKERS_PAGE_SIZE),
          sortBy: 'symbol',
          sortOrder: 'asc'
        }
      }))
    );

    for (const { url, init } of calls) {
      assert.equal(url.search.includes(API_KEY), false);
      assert.deepEqual(init.headers, {
        authorization: `Bearer ${API_KEY}`,
        accept: 'application/json'
      });
      assert.equal(init.redirect, 'error');
    }

    assert.deepEqual(logged, [
      { severity: 'INFO', event: 'ticker_catalog_loaded', count: 2 }
    ]);
  });

  it('lists each kind of share and fund under its instrument type, with its sector or none', async () => {
    const { catalog } = stubCatalog(() =>
      tickersPage([
        ticker('PETR4', { sector: 'Energy Minerals' }),
        ticker('TAEE11', { subType: 'unit', sector: null }),
        ticker('AAPL34', { assetType: 'bdr', subType: 'bdr' }),
        ticker('HGLG11', { assetType: 'fund', subType: 'fii' }),
        ticker('BOVA11', { assetType: 'fund', subType: 'etf' }),
        ticker('JURO11', { assetType: 'fund', subType: 'fi-infra' }),
        ticker('RZAG11', { assetType: 'fund', subType: 'fi-agro' }),
        ticker('BRCR11', { assetType: 'fund', subType: 'fip' }),
        ticker('CPTI11', { assetType: 'fund', subType: 'fidc' })
      ])
    );

    const lookup = await catalog.getListings();

    assert.equal(lookup.outcome, 'listed');
    assert.deepEqual(
      [...lookup.listings.values()].map(({ symbol, type, sector }) => ({
        symbol,
        type,
        sector
      })),
      [
        { symbol: 'PETR4', type: 'STOCK', sector: 'Energy Minerals' },
        { symbol: 'TAEE11', type: 'STOCK', sector: null },
        { symbol: 'AAPL34', type: 'STOCK', sector: 'Finance' },
        { symbol: 'HGLG11', type: 'REIT', sector: 'Finance' },
        { symbol: 'BOVA11', type: 'ETF', sector: 'Finance' },
        { symbol: 'JURO11', type: 'FUND', sector: 'Finance' },
        { symbol: 'RZAG11', type: 'FUND', sector: 'Finance' },
        { symbol: 'BRCR11', type: 'FUND', sector: 'Finance' },
        { symbol: 'CPTI11', type: 'FUND', sector: 'Finance' }
      ]
    );
    assert.deepEqual(lookup.listings.get('PETR4'), {
      symbol: 'PETR4',
      name: 'PETR4 S.A.',
      type: 'STOCK',
      market: 'B3',
      currency: 'BRL',
      sector: 'Energy Minerals'
    });
  });

  it('names a listing by its name, by its long name without one, collapsed and bounded', async () => {
    const { catalog } = stubCatalog(() =>
      tickersPage([
        ticker('VALE3', { name: '  Vale \n S.A. ' }),
        ticker('ITUB4', { name: '', longName: 'Itau Unibanco Holding SA' }),
        ticker('BBAS3', { name: 'B'.repeat(NAME_MAX_LENGTH + 10) })
      ])
    );

    const lookup = await catalog.getListings();

    assert.equal(lookup.outcome, 'listed');
    assert.deepEqual(
      [...lookup.listings.values()].map(({ name }) => name),
      ['Vale S.A.', 'Itau Unibanco Holding SA', 'B'.repeat(NAME_MAX_LENGTH)]
    );
  });

  it('leaves out a ticker out of trading, of another kind, venue or currency, without a name or symbol it can list, and one it cannot read', async () => {
    const { catalog } = stubCatalog(() =>
      tickersPage([
        ticker('OIBR3', { isActive: false }),
        ticker('PETR4', { subType: 'option' }),
        ticker('AAPL', { exchange: 'NASDAQ' }),
        ticker('VALE3', { currency: 'USD' }),
        ticker('ITUB4', { name: undefined, longName: ' ' }),
        ticker('PETR4.SA'),
        ticker('BBDC4XX'),
        ticker('bbas3'),
        { symbol: 'WEGE3' },
        'ABEV3',
        ticker('B3SA3', { sector: 'S'.repeat(100) })
      ])
    );

    assert.deepEqual(await catalog.getListings(), {
      outcome: 'listed',
      listings: new Map([
        [
          'B3SA3',
          {
            symbol: 'B3SA3',
            name: 'B3SA3 S.A.',
            type: 'STOCK',
            market: 'B3',
            currency: 'BRL',
            sector: null
          }
        ]
      ])
    });
  });

  it('keeps the catalog for a day, and reads it again after', async () => {
    const { catalog, calls, advance } = stubCatalog(() =>
      tickersPage([ticker('PETR4')])
    );

    await catalog.getListings();
    advance(CATALOG_TIME_TO_LIVE_MS - 1);
    await catalog.getListings();

    assert.equal(calls.length, 1);

    advance(1);
    await catalog.getListings();

    assert.equal(calls.length, 2);
  });

  it('joins a read already running', async () => {
    const { catalog, calls } = stubCatalog(() =>
      tickersPage([ticker('PETR4')])
    );

    const [first, second] = await Promise.all([
      catalog.getListings(),
      catalog.getListings()
    ]);

    assert.equal(calls.length, 1);
    assert.deepEqual(first, second);
  });

  it('stops after the last page it reads, keeping the ones read', async () => {
    let page = 0;
    const { catalog, calls } = stubCatalog(() => {
      page += 1;

      return tickersPage([ticker(`TICK${page}`)], true);
    });

    assert.deepEqual(
      await symbolsOf(catalog),
      Array.from({ length: MAX_TICKER_PAGES }, (_, index) => `TICK${index + 1}`)
    );
    assert.equal(calls.length, MAX_TICKER_PAGES);
  });

  it('answers unavailable when a page of the first read fails, and leaves the API alone for a while', async () => {
    const responses = [
      tickersPage([ticker('ITUB4')], true),
      json({ message: 'Internal error' }, 500)
    ];
    const { catalog, calls, logged, advance } = stubCatalog(() => {
      const response = responses.shift();

      return response ?? tickersPage([ticker('PETR4')]);
    });

    assert.deepEqual(await catalog.getListings(), { outcome: 'unavailable' });
    assert.deepEqual(logged, [
      {
        severity: 'WARNING',
        event: 'ticker_catalog_unavailable',
        reason: 'status 500',
        retryInMs: FAILURE_COOLDOWN_MS
      }
    ]);

    advance(FAILURE_COOLDOWN_MS - 1);

    assert.deepEqual(await catalog.getListings(), { outcome: 'unavailable' });
    assert.equal(calls.length, 2);

    advance(1);

    assert.deepEqual(await symbolsOf(catalog), ['PETR4']);
    assert.equal(calls.length, 3);
  });

  it('answers the last catalog read, however old, while reading it again fails', async () => {
    const responses = [tickersPage([ticker('PETR4')])];
    const { catalog, calls, advance } = stubCatalog(
      () => responses.shift() ?? json({}, 503)
    );

    await catalog.getListings();
    advance(CATALOG_TIME_TO_LIVE_MS);

    assert.deepEqual(await symbolsOf(catalog), ['PETR4']);

    advance(FAILURE_COOLDOWN_MS);

    assert.deepEqual(await symbolsOf(catalog), ['PETR4']);
    assert.equal(calls.length, 3);
  });

  it('leaves the API alone for the Retry-After of a 429, within an hour', async () => {
    const cases = [
      { retryAfter: '120', retryInMs: 120_000 },
      { retryAfter: '86400', retryInMs: 3_600_000 },
      { retryAfter: 'soon', retryInMs: FAILURE_COOLDOWN_MS }
    ];

    for (const { retryAfter, retryInMs } of cases) {
      const { catalog, calls, logged, advance } = stubCatalog(() =>
        json({ message: 'Cota do plano esgotada' }, 429, {
          'retry-after': retryAfter
        })
      );

      await catalog.getListings();

      assert.deepEqual(logged, [
        {
          severity: 'WARNING',
          event: 'ticker_catalog_unavailable',
          reason: 'status 429',
          retryInMs
        }
      ]);

      advance(retryInMs - 1);
      await catalog.getListings();

      assert.equal(calls.length, 1);

      advance(1);
      await catalog.getListings();

      assert.equal(calls.length, 2);
    }
  });

  it('answers unavailable for a response it cannot read or a request that fails', async () => {
    const cases: Array<{ respond: () => Response; reason: string }> = [
      {
        respond: () => json({ results: 'PETR4', pagination: {} }),
        reason: 'invalid tickers response'
      },
      {
        respond: () =>
          tickersPage(
            Array.from({ length: TICKERS_PAGE_SIZE + 1 }, (_, index) =>
              ticker(`T${index}`)
            )
          ),
        reason: 'invalid tickers response'
      },
      {
        respond: () => new Response('<html>', { status: 200 }),
        reason: 'SyntaxError'
      },
      {
        respond: () => {
          throw new TypeError('fetch failed');
        },
        reason: 'TypeError'
      }
    ];

    for (const { respond, reason } of cases) {
      const { catalog, logged } = stubCatalog(respond);

      assert.deepEqual(await catalog.getListings(), {
        outcome: 'unavailable'
      });
      assert.deepEqual(
        logged.map((entry) => 'reason' in entry && entry.reason),
        [reason]
      );
    }
  });
});
