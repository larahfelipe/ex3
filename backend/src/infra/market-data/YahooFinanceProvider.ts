import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { DecimalColumn, Markets, type Market } from '@/config/Constants';
import { envs } from '@/config/Envs';
import type {
  MarketDataProvider,
  ObservedPrice,
  PriceHistoryLookup,
  PriceInterval,
  PricedInstrument,
  PriceRange,
  QuoteLookup
} from '@/domain/MarketDataProvider';
import { LogSeverities, log, type LogSink } from '@/infra/observability';

export const YAHOO_FINANCE_SOURCE = 'yahoo-finance';

const YAHOO_FINANCE_ORIGIN = 'https://yfapi.net';
const QUOTE_PATH = '/v6/finance/quote';
const CHART_PATH = '/v8/finance/chart/';

/** Assumed, not measured: well above a quote round trip, short enough not to hold a page load. */
const REQUEST_TIMEOUT_MS = 5_000;

/** The provider documents no maximum; its own examples quote 10 symbols per request. */
const QUOTE_BATCH_SIZE = 10;

/**
 * Assumed, not measured: a quote a minute old is current enough for a portfolio
 * view, and reloads within the minute spend none of the plan's request quota.
 */
const QUOTE_TIME_TO_LIVE_MS = 60_000;

/**
 * Assumed, not measured: after a failure the provider is left alone this long,
 * so a provider that is down costs one timeout, not one per page load.
 */
const FAILURE_COOLDOWN_MS = 30_000;

const HTTP_NOT_FOUND = 404;
const MILLISECONDS_PER_SECOND = 1_000;
const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * How far back the provider serves each interval: below one hour only the last
 * 60 days, hourly the last 730, daily without a bound.
 */
const LOOKBACK_DAYS: ReadonlyMap<PriceInterval, number> = new Map([
  ['5m', 60],
  ['15m', 60],
  ['30m', 60],
  ['1h', 730]
]);

/** Rates are stored as daily closes, so a pair is only ever asked at the daily interval. */
const DAILY_RATE_INTERVAL: PriceInterval = '1d';

/** Letters and digits only, so neither can change the path or query of the provider URL. */
const QUOTABLE_SYMBOL_PATTERN = /^[A-Z0-9]+$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const YAHOO_SYMBOL_BY_MARKET: Record<
  Market,
  (symbol: string, currency: string) => string
> = {
  [Markets.B3]: (symbol) => `${symbol}.SA`,
  [Markets.NYSE]: (symbol) => symbol,
  [Markets.NASDAQ]: (symbol) => symbol,
  [Markets.CRYPTO]: (symbol, currency) => `${symbol}-${currency}`
};

/** A price fits the decimal columns, as every monetary value does. */
const PRICE_UPPER_BOUND = 10 ** (DecimalColumn.PRECISION - DecimalColumn.SCALE);

const ISO_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Intl.supportedValuesOf('currency')
);

/** Exact match: Yahoo quotes some listings in minor units, such as `GBp`, a hundredth of `GBP`. */
const CurrencySchema = z
  .string()
  .refine((code) => ISO_CURRENCY_CODES.has(code));
const PriceSchema = z.number().positive().lt(PRICE_UPPER_BOUND);
const EpochSecondsSchema = z.number().int().positive();
const PriceHintSchema = z.number().int().min(0).max(DecimalColumn.SCALE);

const QuoteEnvelopeSchema = z.object({
  quoteResponse: z.object({
    result: z.array(z.looseObject({ symbol: z.string() }))
  })
});

const QuoteSchema = z.object({
  symbol: z.string(),
  currency: CurrencySchema,
  regularMarketPrice: PriceSchema,
  regularMarketTime: EpochSecondsSchema,
  regularMarketPreviousClose: PriceSchema.optional().catch(undefined),
  priceHint: PriceHintSchema.optional()
});

const ChartSchema = z.object({
  chart: z.object({
    result: z.tuple([
      z
        .object({
          meta: z.object({
            currency: CurrencySchema,
            priceHint: PriceHintSchema.optional()
          }),
          timestamp: z.array(EpochSecondsSchema).default([]),
          indicators: z.object({
            quote: z.tuple([
              z.object({ close: z.array(PriceSchema.nullable()).default([]) })
            ])
          })
        })
        .refine(
          ({ timestamp, indicators }) =>
            timestamp.length === indicators.quote[0].close.length
        )
    ])
  })
});

const NOT_FOUND = { outcome: 'not-found' } as const;
const UNAVAILABLE = { outcome: 'unavailable' } as const;

type ProviderResponse =
  | { outcome: 'responded'; body: unknown }
  | typeof NOT_FOUND
  | typeof UNAVAILABLE;

type CachedQuote = {
  lookup: Extract<QuoteLookup, { outcome: 'quoted' | 'not-found' }>;
  cachedAt: number;
};

const isMarket = (market: string): market is Market =>
  Object.hasOwn(YAHOO_SYMBOL_BY_MARKET, market);

const toYahooSymbol = ({ symbol, market, currency }: PricedInstrument) =>
  market !== null &&
  currency !== null &&
  isMarket(market) &&
  QUOTABLE_SYMBOL_PATTERN.test(symbol) &&
  CURRENCY_CODE_PATTERN.test(currency)
    ? YAHOO_SYMBOL_BY_MARKET[market](symbol, currency)
    : null;

const toExchangeRateSymbol = (currency: string, baseCurrency: string) =>
  CURRENCY_CODE_PATTERN.test(currency) &&
  CURRENCY_CODE_PATTERN.test(baseCurrency) &&
  currency !== baseCurrency
    ? `${currency}${baseCurrency}=X`
    : null;

/** Rounds away the binary noise of the provider's floating point, e.g. 47.11000061035156 at 2 places. */
const toDecimalPrice = (
  price: number,
  decimalPlaces: number = DecimalColumn.SCALE
) => new Prisma.Decimal(price).toDecimalPlaces(decimalPlaces).toFixed();

const inBatches = <Item>(items: ReadonlyArray<Item>, size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );

/**
 * `MarketDataProvider` over the YH Finance API. The key goes only in the header
 * of requests to its fixed origin, and a redirect is refused so it is never
 * sent elsewhere. Quotes are cached for `QUOTE_TIME_TO_LIVE_MS` and a symbol
 * already being requested joins that request; when the provider fails, the
 * last quote received is answered, with the timestamp it was observed at. The
 * caches hold only symbols translated from catalog instruments and from pairs
 * of stored currency codes, so they are bounded by what is stored, and they
 * live in this process.
 */
export class YahooFinanceProvider implements MarketDataProvider {
  private static INSTANCE: YahooFinanceProvider;
  private readonly apiKey: string | undefined;
  private readonly fetchResponse: typeof fetch;
  private readonly now: () => number;
  private readonly logEntry: LogSink;
  private readonly quoteCache = new Map<string, CachedQuote>();
  private readonly inFlightQuotes = new Map<string, Promise<QuoteLookup>>();
  private unavailableUntil = 0;

  constructor({
    apiKey,
    fetchResponse = (input, init) => fetch(input, init),
    now = Date.now,
    logEntry = log
  }: YahooFinanceProvider.Options) {
    this.apiKey = apiKey;
    this.fetchResponse = fetchResponse;
    this.now = now;
    this.logEntry = logEntry;
  }

  static getInstance() {
    if (!YahooFinanceProvider.INSTANCE)
      YahooFinanceProvider.INSTANCE = new YahooFinanceProvider({
        apiKey: envs.yahooFinanceApiKey
      });

    return YahooFinanceProvider.INSTANCE;
  }

  async getQuotes(
    instruments: ReadonlyArray<PricedInstrument>
  ): Promise<ReadonlyMap<string, QuoteLookup>> {
    return this.lookUpTranslatedQuotes(
      new Map(
        instruments.map((instrument) => [
          instrument.symbol,
          toYahooSymbol(instrument)
        ])
      )
    );
  }

  /** A rate the provider answers in another currency than `baseCurrency` is not the pair asked for. */
  async getExchangeRates(
    currencies: ReadonlyArray<string>,
    baseCurrency: string
  ): Promise<ReadonlyMap<string, QuoteLookup>> {
    const lookups = await this.lookUpTranslatedQuotes(
      new Map(
        currencies.map((currency) => [
          currency,
          toExchangeRateSymbol(currency, baseCurrency)
        ])
      )
    );

    return new Map(
      [...lookups].map(([currency, lookup]) => [
        currency,
        lookup.outcome === 'quoted' && lookup.quote.currency !== baseCurrency
          ? UNAVAILABLE
          : lookup
      ])
    );
  }

  async getHistoricalPrices(
    instrument: PricedInstrument,
    range: PriceRange,
    interval: PriceInterval
  ): Promise<PriceHistoryLookup> {
    const yahooSymbol = toYahooSymbol(instrument);

    if (yahooSymbol === null) return NOT_FOUND;

    return this.lookUpPriceHistory(yahooSymbol, range, interval);
  }

  /** A series the provider answers in another currency than `baseCurrency` is not the pair asked for. */
  async getHistoricalExchangeRate(
    currency: string,
    baseCurrency: string,
    range: PriceRange
  ): Promise<PriceHistoryLookup> {
    const yahooSymbol = toExchangeRateSymbol(currency, baseCurrency);

    if (yahooSymbol === null) return NOT_FOUND;

    const lookup = await this.lookUpPriceHistory(
      yahooSymbol,
      range,
      DAILY_RATE_INTERVAL
    );

    return lookup.outcome === 'quoted' &&
      lookup.prices.some(({ currency: quoted }) => quoted !== baseCurrency)
      ? UNAVAILABLE
      : lookup;
  }

  private async lookUpPriceHistory(
    yahooSymbol: string,
    { from, to }: PriceRange,
    interval: PriceInterval
  ): Promise<PriceHistoryLookup> {
    if (from.getTime() >= to.getTime())
      return { outcome: 'quoted', prices: [] };

    const lookbackDays = LOOKBACK_DAYS.get(interval);

    if (
      lookbackDays !== undefined &&
      from.getTime() < this.now() - lookbackDays * MILLISECONDS_PER_DAY
    )
      return { outcome: 'range-not-served' };

    const response = await this.request(
      `${CHART_PATH}${encodeURIComponent(yahooSymbol)}`,
      {
        period1: String(Math.floor(from.getTime() / MILLISECONDS_PER_SECOND)),
        period2: String(Math.ceil(to.getTime() / MILLISECONDS_PER_SECOND)),
        interval
      }
    );

    if (response.outcome !== 'responded') return response;

    const chart = ChartSchema.safeParse(response.body);

    if (!chart.success) return this.reportFailure('invalid chart response');

    const [{ meta, timestamp, indicators }] = chart.data.chart.result;
    const [{ close }] = indicators.quote;
    const pricesByInstant = new Map<number, ObservedPrice>();

    timestamp.forEach((seconds, index) => {
      const closingPrice = close[index];
      const observedAt = seconds * MILLISECONDS_PER_SECOND;

      if (
        closingPrice !== null &&
        observedAt >= from.getTime() &&
        observedAt < to.getTime()
      )
        pricesByInstant.set(observedAt, {
          price: toDecimalPrice(closingPrice, meta.priceHint),
          currency: meta.currency,
          timestamp: new Date(observedAt),
          source: YAHOO_FINANCE_SOURCE
        });
    });

    return {
      outcome: 'quoted',
      prices: [...pricesByInstant.values()].toSorted(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      )
    };
  }

  private async lookUpTranslatedQuotes(
    yahooSymbols: ReadonlyMap<string, string | null>
  ): Promise<ReadonlyMap<string, QuoteLookup>> {
    const lookups = await this.lookUpQuotes([
      ...new Set([...yahooSymbols.values()].filter((symbol) => symbol !== null))
    ]);

    return new Map(
      [...yahooSymbols].map(([key, yahooSymbol]) => [
        key,
        yahooSymbol === null
          ? NOT_FOUND
          : (lookups.get(yahooSymbol) ?? UNAVAILABLE)
      ])
    );
  }

  private async lookUpQuotes(yahooSymbols: ReadonlyArray<string>) {
    const now = this.now();
    const lookups = new Map<string, Promise<QuoteLookup>>();
    const unrequested: string[] = [];

    for (const yahooSymbol of yahooSymbols) {
      const cached = this.quoteCache.get(yahooSymbol);
      const inFlight = this.inFlightQuotes.get(yahooSymbol);

      if (cached !== undefined && now - cached.cachedAt < QUOTE_TIME_TO_LIVE_MS)
        lookups.set(yahooSymbol, Promise.resolve(cached.lookup));
      else if (inFlight !== undefined) lookups.set(yahooSymbol, inFlight);
      else unrequested.push(yahooSymbol);
    }

    for (const batch of inBatches(unrequested, QUOTE_BATCH_SIZE)) {
      const batchLookups = this.requestQuotes(batch);

      for (const yahooSymbol of batch) {
        const lookup = batchLookups
          .then(
            (byYahooSymbol) => byYahooSymbol.get(yahooSymbol) ?? UNAVAILABLE
          )
          .finally(() => this.inFlightQuotes.delete(yahooSymbol));

        this.inFlightQuotes.set(yahooSymbol, lookup);
        lookups.set(yahooSymbol, lookup);
      }
    }

    return new Map(
      await Promise.all(
        [...lookups].map(
          async ([yahooSymbol, lookup]) => [yahooSymbol, await lookup] as const
        )
      )
    );
  }

  private async requestQuotes(
    batch: ReadonlyArray<string>
  ): Promise<ReadonlyMap<string, QuoteLookup>> {
    const response = await this.request(QUOTE_PATH, {
      symbols: batch.join(',')
    });
    const envelope =
      response.outcome === 'responded'
        ? QuoteEnvelopeSchema.safeParse(response.body)
        : null;

    if (envelope?.success === false)
      this.reportFailure('invalid quote response');

    if (!envelope?.success)
      return new Map(
        batch.map((yahooSymbol) => [
          yahooSymbol,
          this.quoteCache.get(yahooSymbol)?.lookup ?? UNAVAILABLE
        ])
      );

    const receivedAt = this.now();
    const itemsBySymbol = new Map(
      envelope.data.quoteResponse.result.map((item) => [item.symbol, item])
    );

    return new Map(
      batch.map((yahooSymbol) => {
        const item = itemsBySymbol.get(yahooSymbol);
        const quote = item && QuoteSchema.safeParse(item);

        if (quote?.success === false)
          return [
            yahooSymbol,
            this.quoteCache.get(yahooSymbol)?.lookup ?? UNAVAILABLE
          ];

        const lookup: CachedQuote['lookup'] = quote
          ? {
              outcome: 'quoted',
              quote: {
                price: toDecimalPrice(
                  quote.data.regularMarketPrice,
                  quote.data.priceHint
                ),
                currency: quote.data.currency,
                timestamp: new Date(
                  quote.data.regularMarketTime * MILLISECONDS_PER_SECOND
                ),
                source: YAHOO_FINANCE_SOURCE,
                ...(quote.data.regularMarketPreviousClose !== undefined && {
                  previousClose: toDecimalPrice(
                    quote.data.regularMarketPreviousClose,
                    quote.data.priceHint
                  )
                })
              }
            }
          : NOT_FOUND;

        this.quoteCache.set(yahooSymbol, { lookup, cachedAt: receivedAt });

        return [yahooSymbol, lookup];
      })
    );
  }

  private async request(
    path: string,
    query: Record<string, string>
  ): Promise<ProviderResponse> {
    if (this.apiKey === undefined || this.now() < this.unavailableUntil)
      return UNAVAILABLE;

    const url = new URL(path, YAHOO_FINANCE_ORIGIN);
    url.search = new URLSearchParams(query).toString();

    try {
      const response = await this.fetchResponse(url, {
        headers: { 'x-api-key': this.apiKey, accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.status === HTTP_NOT_FOUND) {
        await response.body?.cancel();
        return NOT_FOUND;
      }

      if (!response.ok) {
        await response.body?.cancel();
        return this.reportFailure(`status ${response.status}`);
      }

      return { outcome: 'responded', body: await response.json() };
    } catch (error) {
      return this.reportFailure(
        error instanceof Error ? error.name : 'unknown error'
      );
    }
  }

  private reportFailure(reason: string): typeof UNAVAILABLE {
    this.unavailableUntil = this.now() + FAILURE_COOLDOWN_MS;
    this.logEntry({
      severity: LogSeverities.WARNING,
      event: 'quote_provider_unavailable',
      reason,
      retryInMs: FAILURE_COOLDOWN_MS
    });

    return UNAVAILABLE;
  }
}

namespace YahooFinanceProvider {
  export type Options = {
    apiKey: string | undefined;
    fetchResponse?: typeof fetch;
    now?: () => number;
    logEntry?: LogSink;
  };
}
