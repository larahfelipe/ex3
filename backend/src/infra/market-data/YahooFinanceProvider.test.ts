import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  PricedInstrument,
  QuoteLookup
} from '@/domain/MarketDataProvider';

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
  const provider = new YahooFinanceProvider({
    apiKey: hasApiKey ? API_KEY : undefined,
    now: () => clock.now,
    fetchResponse: async (input, init = {}) => {
      const url = new URL(String(input));
      calls.push({ url, init });

      return respond(url);
    }
  });

  return { provider, calls, clock };
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

    it('reports a failed request as unavailable and leaves the provider alone during the cooldown', async (t) => {
      const warn = t.mock.method(console, 'warn', () => undefined);
      const { provider, calls, clock } = stubProvider(() => json({}, 503));

      const unavailable = new Map([['AAPL', { outcome: 'unavailable' }]]);

      assert.deepEqual(await provider.getQuotes([AAPL]), unavailable);
      clock.now += FAILURE_COOLDOWN_MS - 1;
      assert.deepEqual(await provider.getQuotes([AAPL]), unavailable);
      assert.equal(calls.length, 1);

      clock.now += 1;
      await provider.getQuotes([AAPL]);
      assert.equal(calls.length, 2);
      assert.ok(
        warn.mock.calls.every(
          ({ arguments: [message] }) => !String(message).includes(API_KEY)
        )
      );
    });

    it('answers the last quote received while the provider fails', async (t) => {
      t.mock.method(console, 'warn', () => undefined);
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

    it('reports a timeout or a network failure as unavailable', async (t) => {
      t.mock.method(console, 'warn', () => undefined);

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

    it('answers a symbol the provider does not know as not found', async () => {
      const { provider } = stubProvider(() =>
        json({ chart: { result: null, error: { code: 'Not Found' } } }, 404)
      );

      assert.deepEqual(
        await provider.getHistoricalPrices(
          PETR4,
          { from: new Date(from), to: new Date(to) },
          '1d'
        ),
        { outcome: 'not-found' }
      );
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
