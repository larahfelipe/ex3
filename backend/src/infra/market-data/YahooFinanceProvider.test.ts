import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FundamentalMetric } from '@/domain/Fundamentals';
import type {
  PricedInstrument,
  QuoteLookup
} from '@/domain/MarketDataProvider';
import type { LogEntry } from '@/infra/observability';

import {
  YAHOO_FINANCE_SOURCE,
  YahooFinanceProvider
} from './YahooFinanceProvider';

const API_KEY = 'yahoo-finance-api-key';
const NOW = Date.parse('2026-09-11T20:00:00.000Z');
const MARKET_TIME = new Date('2026-09-11T19:55:00.000Z');
const MILLISECONDS_PER_SECOND = 1_000;
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** Mirror the constants of `YahooFinanceProvider`. */
const QUOTE_TIME_TO_LIVE_MS = 60_000;
const FAILURE_COOLDOWN_MS = 30_000;
const QUOTE_BATCH_SIZE = 10;
const LISTING_TIME_TO_LIVE_MS = 3_600_000;
const LISTING_CACHE_MAX_ENTRIES = 1_000;
const EMPTY_HISTORY_TIME_TO_LIVE_MS = 3_600_000;
const EMPTY_HISTORY_CACHE_MAX_ENTRIES = 10_000;
const FUNDAMENTALS_TIME_TO_LIVE_MS = 3_600_000;

/** Mirrors `InstrumentLimits.NAME_MAX_LENGTH`. */
const NAME_MAX_LENGTH = 120;

const PETR4: PricedInstrument = {
  symbol: 'PETR4',
  market: 'B3',
  currency: 'BRL'
};
const AAPL: PricedInstrument = {
  symbol: 'AAPL',
  market: 'NASDAQ',
  currency: 'USD'
};
const KO: PricedInstrument = { symbol: 'KO', market: 'NYSE', currency: 'USD' };
const BTC: PricedInstrument = {
  symbol: 'BTC',
  market: 'CRYPTO',
  currency: 'USD'
};

type ProviderCall = { url: URL; init: RequestInit };

const toSeconds = (milliseconds: number) =>
  milliseconds / MILLISECONDS_PER_SECOND;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

const quoteItem = (
  symbol: string,
  overrides: Record<string, unknown> = {}
) => ({
  symbol,
  currency: 'USD',
  regularMarketPrice: 49,
  regularMarketTime: toSeconds(MARKET_TIME.getTime()),
  priceHint: 2,
  marketState: 'CLOSED',
  ...overrides
});

const quoteResponse = (...items: unknown[]) =>
  json({ quoteResponse: { result: items, error: null } });

const listedItem = (symbol: string, overrides: Record<string, unknown> = {}) =>
  quoteItem(symbol, {
    quoteType: 'EQUITY',
    exchange: 'NMS',
    longName: `${symbol} Inc.`,
    shortName: symbol,
    ...overrides
  });

const PETR4_LISTING_ITEM = listedItem('PETR4.SA', {
  currency: 'BRL',
  exchange: 'SAO',
  longName: 'Petróleo Brasileiro S.A. - Petrobras'
});

const PETR4_LISTING = {
  symbol: 'PETR4',
  name: 'Petróleo Brasileiro S.A. - Petrobras',
  type: 'STOCK',
  market: 'B3',
  currency: 'BRL'
};

const summaryResponse = (modules: Record<string, unknown>) =>
  json({ quoteSummary: { result: [modules], error: null } });

const profileResponse = (assetProfile: Record<string, unknown>) =>
  summaryResponse({ assetProfile });

const reportedNumber = (raw: number) => ({ raw, fmt: String(raw) });

const chartResponse = ({
  timestamps,
  closes
}: {
  timestamps?: number[];
  closes?: Array<number | null>;
}) =>
  json({
    chart: {
      result: [
        {
          meta: { currency: 'BRL', symbol: 'PETR4.SA', priceHint: 2 },
          ...(timestamps && { timestamp: timestamps }),
          indicators: { quote: [{ ...(closes && { close: closes }) }] }
        }
      ],
      error: null
    }
  });

const quoted = (
  price: string,
  currency: string,
  timestamp = MARKET_TIME
): QuoteLookup => ({
  outcome: 'quoted',
  quote: { price, currency, timestamp, source: YAHOO_FINANCE_SOURCE }
});

const observedPrice = (price: string, timestamp: number) => ({
  price,
  currency: 'BRL',
  timestamp: new Date(timestamp),
  source: YAHOO_FINANCE_SOURCE
});

const requestedSymbols = ({ url }: ProviderCall) =>
  url.searchParams.get('symbols')?.split(',');

const stubProvider = (
  respond: (url: URL) => Response | Promise<Response>,
  { hasApiKey = true } = {}
) => {
  const clock = { now: NOW };
  const calls: ProviderCall[] = [];
  const logEntries: LogEntry[] = [];
  const provider = new YahooFinanceProvider({
    apiKey: hasApiKey ? API_KEY : undefined,
    now: () => clock.now,
    logEntry: (entry) => logEntries.push(entry),
    fetchResponse: async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });

      return respond(url);
    }
  });

  return { provider, calls, clock, logEntries };
};

describe('YahooFinanceProvider', () => {
  describe('getQuotes', () => {
    it('quotes every market in one request, sending the key only in its header', async () => {
      const { provider, calls } = stubProvider(() =>
        quoteResponse(
          quoteItem('PETR4.SA', {
            currency: 'BRL',
            regularMarketPrice: 47.11000061035156
          }),
          quoteItem('AAPL', { regularMarketPrice: 229.5 }),
          quoteItem('KO', { regularMarketPrice: 70.12 }),
          quoteItem('BTC-USD', { regularMarketPrice: 64000.123456 })
        )
      );

      assert.deepEqual(
        await provider.getQuotes([PETR4, AAPL, KO, BTC]),
        new Map([
          ['PETR4', quoted('47.11', 'BRL')],
          ['AAPL', quoted('229.5', 'USD')],
          ['KO', quoted('70.12', 'USD')],
          ['BTC', quoted('64000.12', 'USD')]
        ])
      );

      assert.equal(calls.length, 1);
      const [{ url, init }] = calls;
      assert.equal(url.origin, 'https://yfapi.net');
      assert.equal(url.pathname, '/v6/finance/quote');
      assert.deepEqual(requestedSymbols(calls[0]), [
        'PETR4.SA',
        'AAPL',
        'KO',
        'BTC-USD'
      ]);
      assert.equal(new Headers(init.headers).get('x-api-key'), API_KEY);
      assert.ok(!url.href.includes(API_KEY));
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
    });

    it('answers an instrument it cannot price as not found, requesting nothing', async () => {
      const { provider, calls } = stubProvider(() => quoteResponse());

      assert.deepEqual(
        await provider.getQuotes([
          { symbol: 'VOD', market: 'LSE', currency: 'GBP' },
          { symbol: 'PETR3', market: null, currency: null },
          { symbol: 'BRK.B', market: 'NYSE', currency: 'USD' }
        ]),
        new Map([
          ['VOD', { outcome: 'not-found' }],
          ['PETR3', { outcome: 'not-found' }],
          ['BRK.B', { outcome: 'not-found' }]
        ])
      );
      assert.equal(calls.length, 0);
    });

    it('answers a symbol missing from the response as not found, without asking again', async () => {
      const { provider, calls } = stubProvider(() => quoteResponse());

      for (let lookup = 0; lookup < 2; lookup += 1)
        assert.deepEqual(
          await provider.getQuotes([PETR4]),
          new Map([['PETR4', { outcome: 'not-found' }]])
        );

      assert.equal(calls.length, 1);
    });

    it('reuses a quote within its time to live and requests it again once it expires', async () => {
      const { provider, calls, clock } = stubProvider(() =>
        quoteResponse(quoteItem('AAPL'))
      );

      await provider.getQuotes([AAPL]);
      clock.now += QUOTE_TIME_TO_LIVE_MS - 1;
      await provider.getQuotes([AAPL]);
      assert.equal(calls.length, 1);

      clock.now += 1;
      await provider.getQuotes([AAPL]);
      assert.equal(calls.length, 2);
    });

    it('joins a lookup of a symbol already being requested', async () => {
      const { provider, calls } = stubProvider((url) =>
        quoteResponse(
          ...(url.searchParams.get('symbols') ?? '')
            .split(',')
            .map((symbol) => quoteItem(symbol))
        )
      );

      const [first, second] = await Promise.all([
        provider.getQuotes([AAPL]),
        provider.getQuotes([AAPL, KO])
      ]);

      assert.deepEqual(calls.map(requestedSymbols), [['AAPL'], ['KO']]);
      assert.deepEqual(first.get('AAPL'), quoted('49', 'USD'));
      assert.deepEqual(second.get('AAPL'), quoted('49', 'USD'));
      assert.deepEqual(second.get('KO'), quoted('49', 'USD'));
    });

    it('splits the symbols into requests of at most ten', async () => {
      const { provider, calls } = stubProvider(() => quoteResponse());
      const instruments = Array.from(
        { length: QUOTE_BATCH_SIZE + 1 },
        (_, index) => ({
          symbol: `S${index}`,
          market: 'NASDAQ',
          currency: 'USD'
        })
      );

      await provider.getQuotes(instruments);

      assert.deepEqual(
        calls.map((call) => requestedSymbols(call)?.length),
        [QUOTE_BATCH_SIZE, 1]
      );
    });

    it('answers every quote as unavailable without a key, requesting nothing', async () => {
      const { provider, calls } = stubProvider(() => quoteResponse(), {
        hasApiKey: false
      });

      assert.deepEqual(
        await provider.getQuotes([AAPL]),
        new Map([['AAPL', { outcome: 'unavailable' }]])
      );
      assert.equal(calls.length, 0);
    });

    it('reports a failed request as unavailable and leaves the provider alone during the cooldown', async () => {
      const { provider, calls, clock, logEntries } = stubProvider(() =>
        json({}, 503)
      );

      const unavailable = new Map([['AAPL', { outcome: 'unavailable' }]]);

      assert.deepEqual(await provider.getQuotes([AAPL]), unavailable);
      clock.now += FAILURE_COOLDOWN_MS - 1;
      assert.deepEqual(await provider.getQuotes([AAPL]), unavailable);
      assert.equal(calls.length, 1);

      clock.now += 1;
      await provider.getQuotes([AAPL]);
      assert.equal(calls.length, 2);
      assert.deepEqual(
        logEntries.map(({ event }) => event),
        ['quote_provider_unavailable', 'quote_provider_unavailable']
      );
      assert.ok(
        logEntries.every((entry) => !JSON.stringify(entry).includes(API_KEY))
      );
    });

    it('answers the last quote received while the provider fails', async () => {
      const responses = [quoteResponse(quoteItem('AAPL')), json({}, 429)];
      const { provider, clock } = stubProvider(
        () => responses.shift() ?? json({}, 500)
      );

      await provider.getQuotes([AAPL]);
      clock.now += QUOTE_TIME_TO_LIVE_MS;

      assert.deepEqual(
        await provider.getQuotes([AAPL]),
        new Map([['AAPL', quoted('49', 'USD')]])
      );
    });

    it('reports a timeout or a network failure as unavailable', async () => {
      for (const failure of [
        new DOMException('The operation timed out', 'TimeoutError'),
        new TypeError('fetch failed')
      ]) {
        const { provider } = stubProvider(() => Promise.reject(failure));

        assert.deepEqual(
          await provider.getQuotes([AAPL]),
          new Map([['AAPL', { outcome: 'unavailable' }]])
        );
      }
    });

    it('refuses a response outside the expected shape', async (t) => {
      t.mock.method(console, 'warn', () => undefined);

      for (const response of [
        json({ unexpected: true }),
        new Response('<html>', { status: 200 })
      ]) {
        const { provider } = stubProvider(() => response);

        assert.deepEqual(
          await provider.getQuotes([AAPL]),
          new Map([['AAPL', { outcome: 'unavailable' }]])
        );
      }
    });

    it('answers an invalid quote as unavailable, next to the valid ones', async () => {
      const { provider } = stubProvider(() =>
        quoteResponse(
          quoteItem('PETR4.SA', { currency: 'BRp' }),
          quoteItem('AAPL', { regularMarketPrice: -1 }),
          quoteItem('KO', { regularMarketTime: undefined }),
          quoteItem('MSFT', { regularMarketPrice: 1e20 }),
          quoteItem('BTC-USD')
        )
      );

      assert.deepEqual(
        await provider.getQuotes([
          PETR4,
          AAPL,
          KO,
          { symbol: 'MSFT', market: 'NASDAQ', currency: 'USD' },
          BTC
        ]),
        new Map<string, QuoteLookup>([
          ['PETR4', { outcome: 'unavailable' }],
          ['AAPL', { outcome: 'unavailable' }],
          ['KO', { outcome: 'unavailable' }],
          ['MSFT', { outcome: 'unavailable' }],
          ['BTC', quoted('49', 'USD')]
        ])
      );
    });

    it('answers the previous close, leaving out one that is not a valid price', async () => {
      const { provider } = stubProvider(() =>
        quoteResponse(
          quoteItem('AAPL', {
            regularMarketPrice: 229.5,
            regularMarketPreviousClose: 225.12000274658203
          }),
          quoteItem('KO', {
            regularMarketPrice: 70.12,
            regularMarketPreviousClose: -1
          })
        )
      );

      assert.deepEqual(
        await provider.getQuotes([AAPL, KO]),
        new Map([
          [
            'AAPL',
            {
              outcome: 'quoted',
              quote: {
                price: '229.5',
                currency: 'USD',
                timestamp: MARKET_TIME,
                source: YAHOO_FINANCE_SOURCE,
                previousClose: '225.12'
              }
            }
          ],
          ['KO', quoted('70.12', 'USD')]
        ])
      );
    });
  });

  describe('getExchangeRates', () => {
    it('quotes the pair of each currency to the base currency, reusing it within its time to live', async () => {
      const { provider, calls } = stubProvider(() =>
        quoteResponse(
          quoteItem('USDBRL=X', {
            currency: 'BRL',
            regularMarketPrice: 5.412300395965576,
            priceHint: 4
          }),
          quoteItem('EURBRL=X', {
            currency: 'BRL',
            regularMarketPrice: 6.1,
            priceHint: 4
          })
        )
      );

      assert.deepEqual(
        await provider.getExchangeRates(['USD', 'EUR'], 'BRL'),
        new Map([
          ['USD', quoted('5.4123', 'BRL')],
          ['EUR', quoted('6.1', 'BRL')]
        ])
      );
      assert.deepEqual(
        await provider.getExchangeRates(['USD'], 'BRL'),
        new Map([['USD', quoted('5.4123', 'BRL')]])
      );
      assert.equal(calls.length, 1);
      assert.deepEqual(requestedSymbols(calls[0]), ['USDBRL=X', 'EURBRL=X']);
    });

    it('answers a code it cannot pair as not found, requesting nothing', async () => {
      const { provider, calls } = stubProvider(() => quoteResponse());

      assert.deepEqual(
        await provider.getExchangeRates(['BRL', 'usd', 'US$'], 'BRL'),
        new Map([
          ['BRL', { outcome: 'not-found' }],
          ['usd', { outcome: 'not-found' }],
          ['US$', { outcome: 'not-found' }]
        ])
      );
      assert.equal(calls.length, 0);
    });

    it('refuses a rate quoted in another currency than the base', async () => {
      const { provider } = stubProvider(() =>
        quoteResponse(
          quoteItem('USDBRL=X', { currency: 'USD', regularMarketPrice: 5.41 })
        )
      );

      assert.deepEqual(
        await provider.getExchangeRates(['USD'], 'BRL'),
        new Map([['USD', { outcome: 'unavailable' }]])
      );
    });

    it('leaves the provider alone during the cooldown of a failed quote request', async (t) => {
      t.mock.method(console, 'warn', () => undefined);
      const { provider, calls } = stubProvider(() => json({}, 503));

      await provider.getQuotes([AAPL]);

      assert.deepEqual(
        await provider.getExchangeRates(['USD'], 'BRL'),
        new Map([['USD', { outcome: 'unavailable' }]])
      );
      assert.equal(calls.length, 1);
    });
  });

  describe('findListings', () => {
    it('looks a symbol up under every market in one request, listing it where the venue and currency are that market own', async () => {
      const { provider, calls } = stubProvider(() =>
        quoteResponse(
          PETR4_LISTING_ITEM,
          listedItem('PETR4-USD', { exchange: 'NMS' })
        )
      );

      assert.deepEqual(await provider.findListings('PETR4'), {
        outcome: 'searched',
        listings: [PETR4_LISTING]
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.pathname, '/v6/finance/quote');
      assert.deepEqual(requestedSymbols(calls[0]), [
        'PETR4.SA',
        'PETR4',
        'PETR4-BRL',
        'PETR4-USD',
        'PETR4-EUR'
      ]);
    });

    it('tells NYSE from NASDAQ by the venue and lists a crypto pair in each currency the provider quotes', async () => {
      const { provider } = stubProvider(() =>
        quoteResponse(
          listedItem('AAPL', { longName: 'Apple Inc.' }),
          listedItem('KO', {
            exchange: 'NYQ',
            longName: 'The Coca-Cola Company'
          }),
          listedItem('BTC-BRL', {
            currency: 'BRL',
            exchange: 'CCC',
            quoteType: 'CRYPTOCURRENCY',
            longName: 'Bitcoin BRL'
          }),
          listedItem('BTC-USD', {
            exchange: 'CCC',
            quoteType: 'CRYPTOCURRENCY',
            longName: 'Bitcoin USD'
          })
        )
      );

      const listingsOf = async (symbol: string) => {
        const search = await provider.findListings(symbol);

        return search.outcome === 'searched'
          ? search.listings.map(({ market, currency, type }) => ({
              market,
              currency,
              type
            }))
          : search;
      };

      assert.deepEqual(await listingsOf('AAPL'), [
        { market: 'NASDAQ', currency: 'USD', type: 'STOCK' }
      ]);
      assert.deepEqual(await listingsOf('KO'), [
        { market: 'NYSE', currency: 'USD', type: 'STOCK' }
      ]);
      assert.deepEqual(await listingsOf('BTC'), [
        { market: 'CRYPTO', currency: 'BRL', type: 'CRYPTO' },
        { market: 'CRYPTO', currency: 'USD', type: 'CRYPTO' }
      ]);
    });

    it('classes a listing by its quote type, a B3 real estate fund as one, and leaves out a type or venue it does not know', async () => {
      const { provider } = stubProvider(() =>
        quoteResponse(
          listedItem('KNRI11.SA', {
            currency: 'BRL',
            exchange: 'SAO',
            longName:
              'Kinea Renda Imobiliária Fundo de Investimento Imobiliário'
          }),
          listedItem('BOVA11.SA', {
            currency: 'BRL',
            exchange: 'SAO',
            quoteType: 'ETF'
          }),
          listedItem('VFIAX', { quoteType: 'MUTUALFUND' }),
          listedItem('SPX', { quoteType: 'INDEX' }),
          listedItem('OTCX', { exchange: 'PNK' })
        )
      );

      const typesOf = async (symbol: string) => {
        const search = await provider.findListings(symbol);

        return search.outcome === 'searched'
          ? search.listings.map(({ type }) => type)
          : search;
      };

      assert.deepEqual(await typesOf('KNRI11'), ['REIT']);
      assert.deepEqual(await typesOf('BOVA11'), ['ETF']);
      assert.deepEqual(await typesOf('VFIAX'), ['FUND']);
      assert.deepEqual(await typesOf('SPX'), []);
      assert.deepEqual(await typesOf('OTCX'), []);
    });

    it('names a listing by its long name, else by its short one, bounded and on one line', async () => {
      const longName = `Very\n  Long ${'N'.repeat(NAME_MAX_LENGTH)}`;
      const { provider } = stubProvider(() =>
        quoteResponse(
          listedItem('AAPL', { longName: undefined, shortName: ' Apple ' }),
          listedItem('MSFT', { longName }),
          listedItem('NONAME', { longName: ' ', shortName: undefined })
        )
      );

      const namesOf = async (symbol: string) => {
        const search = await provider.findListings(symbol);

        return search.outcome === 'searched'
          ? search.listings.map(({ name }) => name)
          : search;
      };

      assert.deepEqual(await namesOf('AAPL'), ['Apple']);
      assert.deepEqual(await namesOf('MSFT'), [
        `Very Long ${'N'.repeat(NAME_MAX_LENGTH)}`.slice(0, NAME_MAX_LENGTH)
      ]);
      assert.deepEqual(await namesOf('NONAME'), []);
    });

    it('reuses a search within its time to live and answers the last one while the provider fails', async () => {
      const responses = [quoteResponse(PETR4_LISTING_ITEM), json({}, 503)];
      const { provider, calls, clock } = stubProvider(
        () => responses.shift() ?? json({}, 500)
      );
      const searched = { outcome: 'searched', listings: [PETR4_LISTING] };

      assert.deepEqual(await provider.findListings('PETR4'), searched);
      clock.now += LISTING_TIME_TO_LIVE_MS - 1;
      assert.deepEqual(await provider.findListings('PETR4'), searched);
      assert.equal(calls.length, 1);

      clock.now += 1;
      assert.deepEqual(await provider.findListings('PETR4'), searched);
      assert.equal(calls.length, 2);
    });

    it('answers unavailable without a key or when the provider fails, and requests nothing for a symbol it cannot quote', async () => {
      const withoutKey = stubProvider(() => quoteResponse(), {
        hasApiKey: false
      });
      const failing = stubProvider(() => json({}, 503));

      assert.deepEqual(await withoutKey.provider.findListings('PETR4'), {
        outcome: 'unavailable'
      });
      assert.deepEqual(await failing.provider.findListings('PETR4'), {
        outcome: 'unavailable'
      });
      assert.deepEqual(await failing.provider.findListings('BRK.B'), {
        outcome: 'searched',
        listings: []
      });
      assert.equal(withoutKey.calls.length, 0);
      assert.equal(failing.calls.length, 1);
    });

    it('bounds the searches it keeps, dropping the oldest first', async () => {
      const { provider, calls } = stubProvider(() => quoteResponse());
      const symbols = Array.from(
        { length: LISTING_CACHE_MAX_ENTRIES + 1 },
        (_, index) => `S${index}`
      );

      for (const symbol of symbols) await provider.findListings(symbol);

      await provider.findListings(symbols[1]);
      assert.equal(calls.length, symbols.length);

      await provider.findListings(symbols[0]);
      assert.equal(calls.length, symbols.length + 1);
    });
  });

  describe('describeListing', () => {
    it('describes the listing of the market and currency given, with the sector of an equity from its profile', async () => {
      const { provider, calls } = stubProvider((url) =>
        url.pathname.startsWith('/v11/finance/quoteSummary/')
          ? profileResponse({ sector: 'Energy', industry: 'Oil & Gas' })
          : quoteResponse(PETR4_LISTING_ITEM)
      );

      assert.deepEqual(await provider.describeListing(PETR4), {
        outcome: 'listed',
        listing: { ...PETR4_LISTING, sector: 'Energy' }
      });
      assert.equal(calls.length, 2);
      assert.equal(calls[1].url.pathname, '/v11/finance/quoteSummary/PETR4.SA');
      assert.equal(calls[1].url.searchParams.get('modules'), 'assetProfile');
      assert.equal(
        new Headers(calls[1].init.headers).get('x-api-key'),
        API_KEY
      );
    });

    it('asks no profile for a listing without a sector and answers not found for another market or currency', async () => {
      const { provider, calls } = stubProvider(() =>
        quoteResponse(
          PETR4_LISTING_ITEM,
          listedItem('BTC-USD', {
            exchange: 'CCC',
            quoteType: 'CRYPTOCURRENCY',
            longName: 'Bitcoin USD'
          })
        )
      );

      assert.deepEqual(await provider.describeListing(BTC), {
        outcome: 'listed',
        listing: {
          symbol: 'BTC',
          name: 'Bitcoin USD',
          type: 'CRYPTO',
          market: 'CRYPTO',
          currency: 'USD',
          sector: null
        }
      });
      assert.deepEqual(
        await provider.describeListing({
          ...PETR4,
          market: 'NYSE',
          currency: 'USD'
        }),
        { outcome: 'not-found' }
      );
      assert.equal(calls.length, 2);
    });

    it('answers no sector when the profile fails, without leaving quotes alone', async () => {
      for (const profile of [json({}, 403), json({ unexpected: true })]) {
        const { provider, calls, logEntries } = stubProvider((url) =>
          url.pathname.startsWith('/v11/finance/quoteSummary/')
            ? profile
            : quoteResponse(PETR4_LISTING_ITEM, quoteItem('AAPL'))
        );

        assert.deepEqual(await provider.describeListing(PETR4), {
          outcome: 'listed',
          listing: { ...PETR4_LISTING, sector: null }
        });
        assert.deepEqual(
          await provider.getQuotes([AAPL]),
          new Map([['AAPL', quoted('49', 'USD')]])
        );
        assert.equal(calls.length, 3);
        assert.deepEqual(
          logEntries.map(({ event }) => event),
          ['quote_provider_request_failed']
        );
      }
    });

    it('answers unavailable when the provider cannot search', async () => {
      const { provider } = stubProvider(() => json({}, 503));

      assert.deepEqual(await provider.describeListing(PETR4), {
        outcome: 'unavailable'
      });
    });
  });

  describe('getFundamentals', () => {
    const COMPANY_METRICS: ReadonlyArray<FundamentalMetric> = [
      'priceToEarnings',
      'dividendYield',
      'returnOnEquity',
      'profitMargin',
      'debtToEquity',
      'revenueGrowth',
      'earningsGrowth',
      'freeCashFlow'
    ];

    const COMPANY_SUMMARY = {
      financialData: {
        financialCurrency: 'USD',
        returnOnEquity: reportedNumber(1.5081),
        profitMargins: reportedNumber(0.243),
        debtToEquity: reportedNumber(151.862),
        revenueGrowth: reportedNumber(0.061),
        earningsGrowth: reportedNumber(-0.017),
        freeCashflow: reportedNumber(94873747456)
      },
      summaryDetail: {
        trailingPE: reportedNumber(37.21),
        trailingAnnualDividendYield: reportedNumber(0.0041),
        yield: {}
      }
    };

    const isSummaryRequest = ({ pathname }: URL) =>
      pathname.startsWith('/v11/finance/quoteSummary/');

    it('reads each metric asked for from its module in one request, debt to equity as a multiple', async () => {
      const { provider, calls } = stubProvider(() =>
        summaryResponse(COMPANY_SUMMARY)
      );

      assert.deepEqual(await provider.getFundamentals(AAPL, COMPANY_METRICS), {
        outcome: 'reported',
        source: YAHOO_FINANCE_SOURCE,
        fundamentals: {
          priceToEarnings: '37.21',
          dividendYield: '0.0041',
          returnOnEquity: '1.5081',
          profitMargin: '0.243',
          debtToEquity: '1.51862',
          revenueGrowth: '0.061',
          earningsGrowth: '-0.017',
          freeCashFlow: { amount: '94873747456', currency: 'USD' }
        }
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.pathname, '/v11/finance/quoteSummary/AAPL');
      assert.equal(
        calls[0].url.searchParams.get('modules'),
        'financialData,summaryDetail'
      );
      assert.equal(
        new Headers(calls[0].init.headers).get('x-api-key'),
        API_KEY
      );
    });

    it('asks for the summary alone when only the yield is asked for, reading a fund yield and nothing else', async () => {
      const { provider, calls } = stubProvider(() =>
        summaryResponse({
          summaryDetail: {
            trailingPE: reportedNumber(25.4),
            yield: reportedNumber(0.0123)
          }
        })
      );

      assert.deepEqual(
        await provider.getFundamentals(
          { symbol: 'IVV', market: 'NYSE', currency: 'USD' },
          ['dividendYield']
        ),
        {
          outcome: 'reported',
          source: YAHOO_FINANCE_SOURCE,
          fundamentals: { dividendYield: '0.0123' }
        }
      );
      assert.equal(calls[0].url.searchParams.get('modules'), 'summaryDetail');
    });

    it('leaves out a figure it does not report or cannot read, and free cash flow without an ISO currency', async () => {
      const { provider } = stubProvider(() =>
        summaryResponse({
          financialData: {
            financialCurrency: 'GBp',
            returnOnEquity: {},
            profitMargins: reportedNumber(0.1),
            debtToEquity: 'high',
            revenueGrowth: 0.05,
            freeCashflow: reportedNumber(1000)
          }
        })
      );

      assert.deepEqual(await provider.getFundamentals(AAPL, COMPANY_METRICS), {
        outcome: 'reported',
        source: YAHOO_FINANCE_SOURCE,
        fundamentals: { profitMargin: '0.1', revenueGrowth: '0.05' }
      });
    });

    it('reuses the fundamentals of a symbol, known or not, within their time to live', async () => {
      const { provider, calls, clock } = stubProvider((url) =>
        url.pathname.endsWith('/KO')
          ? json({}, 404)
          : summaryResponse(COMPANY_SUMMARY)
      );
      const lookUpBoth = () =>
        Promise.all([
          provider.getFundamentals(AAPL, ['priceToEarnings']),
          provider.getFundamentals(KO, ['priceToEarnings'])
        ]);
      const answered = [
        {
          outcome: 'reported',
          source: YAHOO_FINANCE_SOURCE,
          fundamentals: { priceToEarnings: '37.21' }
        },
        { outcome: 'not-found' }
      ];

      assert.deepEqual(await lookUpBoth(), answered);
      clock.now += FUNDAMENTALS_TIME_TO_LIVE_MS - 1;
      assert.deepEqual(await lookUpBoth(), answered);
      assert.equal(calls.length, 2);

      clock.now += 1;
      assert.deepEqual(await lookUpBoth(), answered);
      assert.equal(calls.length, 4);
    });

    it('answers an instrument it cannot translate as not found, requesting nothing', async () => {
      const { provider, calls } = stubProvider(() =>
        summaryResponse(COMPANY_SUMMARY)
      );

      for (const instrument of [
        { symbol: 'BRK.B', market: 'NYSE', currency: 'USD' },
        { symbol: 'HOUSE', market: null, currency: null }
      ])
        assert.deepEqual(
          await provider.getFundamentals(instrument, COMPANY_METRICS),
          { outcome: 'not-found' }
        );

      assert.equal(calls.length, 0);
    });

    it('answers unavailable when the request fails or its response is outside the expected shape, asking again next time without leaving quotes alone', async () => {
      for (const summary of [
        () => json({}, 503),
        () => json({ unexpected: true })
      ]) {
        const { provider, calls, logEntries } = stubProvider((url) =>
          isSummaryRequest(url) ? summary() : quoteResponse(quoteItem('AAPL'))
        );

        for (let attempt = 0; attempt < 2; attempt += 1)
          assert.deepEqual(
            await provider.getFundamentals(AAPL, ['priceToEarnings']),
            { outcome: 'unavailable' }
          );

        assert.deepEqual(
          await provider.getQuotes([AAPL]),
          new Map([['AAPL', quoted('49', 'USD')]])
        );
        assert.equal(
          calls.filter(({ url }) => isSummaryRequest(url)).length,
          2
        );
        assert.deepEqual(
          logEntries.map(({ event }) => event),
          ['quote_provider_request_failed', 'quote_provider_request_failed']
        );
      }
    });
  });

  describe('getHistoricalPrices', () => {
    const from = NOW - 2 * ONE_DAY_MS;
    const to = NOW;

    it('answers the closing price of each interval of the range, in order', async () => {
      const { provider, calls } = stubProvider(() =>
        chartResponse({
          timestamps: [
            from - ONE_HOUR_MS,
            from,
            from + ONE_HOUR_MS,
            from + 2 * ONE_HOUR_MS,
            to
          ].map(toSeconds),
          closes: [46.5, 47.11000061035156, null, 48.2, 49]
        })
      );

      assert.deepEqual(
        await provider.getHistoricalPrices(
          PETR4,
          { from: new Date(from), to: new Date(to) },
          '1h'
        ),
        {
          outcome: 'quoted',
          prices: [
            observedPrice('47.11', from),
            observedPrice('48.2', from + 2 * ONE_HOUR_MS)
          ]
        }
      );

      const [{ url }] = calls;
      assert.equal(url.pathname, '/v8/finance/chart/PETR4.SA');
      assert.equal(url.searchParams.get('period1'), String(toSeconds(from)));
      assert.equal(url.searchParams.get('period2'), String(toSeconds(to)));
      assert.equal(url.searchParams.get('interval'), '1h');
    });

    it('answers a range older than the provider keeps at the interval, requesting nothing', async () => {
      const { provider, calls } = stubProvider(() => chartResponse({}));
      const since = (days: number) => ({
        from: new Date(NOW - days * ONE_DAY_MS),
        to: new Date(NOW)
      });

      assert.deepEqual(
        await provider.getHistoricalPrices(PETR4, since(61), '5m'),
        { outcome: 'range-not-served' }
      );
      assert.deepEqual(
        await provider.getHistoricalPrices(PETR4, since(731), '1h'),
        { outcome: 'range-not-served' }
      );
      assert.equal(calls.length, 0);

      assert.deepEqual(
        await provider.getHistoricalPrices(PETR4, since(60), '5m'),
        { outcome: 'quoted', prices: [] }
      );
      assert.deepEqual(
        await provider.getHistoricalPrices(PETR4, since(3650), '1d'),
        { outcome: 'quoted', prices: [] }
      );
      assert.equal(calls.length, 2);
    });

    it('answers an empty range with no prices, requesting nothing', async () => {
      const { provider, calls } = stubProvider(() => chartResponse({}));

      assert.deepEqual(
        await provider.getHistoricalPrices(
          PETR4,
          { from: new Date(to), to: new Date(to) },
          '1d'
        ),
        { outcome: 'quoted', prices: [] }
      );
      assert.equal(calls.length, 0);
    });

    it('answers a symbol the provider does not know as not found, without asking again', async () => {
      const { provider, calls } = stubProvider(() =>
        json({ chart: { result: null, error: { code: 'Not Found' } } }, 404)
      );
      const range = { from: new Date(from), to: new Date(to) };

      assert.deepEqual(await provider.getHistoricalPrices(PETR4, range, '1d'), {
        outcome: 'not-found'
      });
      assert.deepEqual(await provider.getHistoricalPrices(PETR4, range, '1d'), {
        outcome: 'not-found'
      });
      assert.equal(calls.length, 1);
    });

    it('answers a range it found empty again without a request until its time to live expires', async () => {
      const { provider, calls, clock } = stubProvider(() => chartResponse({}));
      const range = { from: new Date(from), to: new Date(to) };

      await provider.getHistoricalPrices(PETR4, range, '1d');
      clock.now += EMPTY_HISTORY_TIME_TO_LIVE_MS - 1;
      assert.deepEqual(await provider.getHistoricalPrices(PETR4, range, '1d'), {
        outcome: 'quoted',
        prices: []
      });
      assert.equal(calls.length, 1);

      clock.now += 1;
      await provider.getHistoricalPrices(PETR4, range, '1d');
      assert.equal(calls.length, 2);
    });

    it('asks again for a range the provider failed to answer or answered with prices', async () => {
      let isFailing = true;
      const { provider, calls, clock } = stubProvider(() =>
        isFailing
          ? json({}, 500)
          : chartResponse({ timestamps: [toSeconds(from)], closes: [47] })
      );
      const range = { from: new Date(from), to: new Date(to) };

      assert.deepEqual(await provider.getHistoricalPrices(PETR4, range, '1d'), {
        outcome: 'unavailable'
      });

      isFailing = false;
      clock.now += FAILURE_COOLDOWN_MS;
      await provider.getHistoricalPrices(PETR4, range, '1d');
      assert.deepEqual(await provider.getHistoricalPrices(PETR4, range, '1d'), {
        outcome: 'quoted',
        prices: [observedPrice('47', from)]
      });
      assert.equal(calls.length, 3);
    });

    it('joins a lookup of a range already being requested', async () => {
      const { provider, calls } = stubProvider(() =>
        chartResponse({ timestamps: [toSeconds(from)], closes: [47] })
      );
      const range = { from: new Date(from), to: new Date(to) };

      const lookups = await Promise.all([
        provider.getHistoricalPrices(PETR4, range, '1d'),
        provider.getHistoricalPrices(PETR4, range, '1d')
      ]);

      assert.equal(calls.length, 1);
      assert.deepEqual(lookups, [
        { outcome: 'quoted', prices: [observedPrice('47', from)] },
        { outcome: 'quoted', prices: [observedPrice('47', from)] }
      ]);
    });

    it('bounds the empty ranges it keeps, dropping the oldest first', async () => {
      const { provider, calls } = stubProvider(() => chartResponse({}));
      const ranges = Array.from(
        { length: EMPTY_HISTORY_CACHE_MAX_ENTRIES + 1 },
        (_, index) => ({
          from: new Date(from - index * ONE_DAY_MS),
          to: new Date(to)
        })
      );

      for (const range of ranges)
        await provider.getHistoricalPrices(PETR4, range, '1d');

      await provider.getHistoricalPrices(PETR4, ranges[1], '1d');
      assert.equal(calls.length, ranges.length);

      await provider.getHistoricalPrices(PETR4, ranges[0], '1d');
      assert.equal(calls.length, ranges.length + 1);
    });

    it('refuses a chart whose prices do not line up with its timestamps', async (t) => {
      t.mock.method(console, 'warn', () => undefined);
      const { provider } = stubProvider(() =>
        chartResponse({ timestamps: [toSeconds(from)], closes: [47, 48] })
      );

      assert.deepEqual(
        await provider.getHistoricalPrices(
          PETR4,
          { from: new Date(from), to: new Date(to) },
          '1d'
        ),
        { outcome: 'unavailable' }
      );
    });
  });
});
