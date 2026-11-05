import { Prisma } from '@prisma/client';
import { z } from 'zod';

import {
  CryptoListingCurrencies,
  DecimalColumn,
  InstrumentLimits,
  InstrumentTypes,
  MarketQuoteCurrencies,
  Markets,
  type Market
} from '@/config/Constants';
import { envs } from '@/config/Envs';
import type {
  FundamentalMetric,
  FundamentalRatio,
  ReportedFundamentals
} from '@/domain/Fundamentals';
import type {
  FundamentalsLookup,
  Listing,
  ListingLookup,
  ListingSearch,
  MarketDataProvider,
  ObservedPrice,
  PricedInstrument,
  PriceHistoryLookup,
  PriceInterval,
  PriceRange,
  QuoteLookup
} from '@/domain/MarketDataProvider';
import type { InstrumentType } from '@/domain/models';
import { log, LogSeverities, type LogSink } from '@/infra/observability';

export const YAHOO_FINANCE_SOURCE = 'yahoo-finance';

const YAHOO_FINANCE_ORIGIN = 'https://yfapi.net';
const QUOTE_PATH = '/v6/finance/quote';
const CHART_PATH = '/v8/finance/chart/';
const QUOTE_SUMMARY_PATH = '/v11/finance/quoteSummary/';
const PROFILE_MODULE = 'assetProfile';
const FINANCIAL_DATA_MODULE = 'financialData';
const SUMMARY_DETAIL_MODULE = 'summaryDetail';

/** Assumed, not measured: well above a quote round trip, short enough not to hold a page load. */
const REQUEST_TIMEOUT_MS = 5_000;

/** The provider documents no maximum; its own examples quote 10 symbols per request. */
const QUOTE_BATCH_SIZE = 10;

/**
 * Seen on this account, not documented: an import looking listings up four at
 * a time was answered throughout, while a first performance read, which asked
 * for the history of every instrument at once, had 22 requests refused with
 * 429. Past this many, a request waits for one of them to finish.
 */
const MAX_CONCURRENT_REQUESTS = 4;

/**
 * The endpoint of current quotes, and of searches, goes ahead of histories and
 * summaries: it is what a page shows first, and one request answers up to
 * `QUOTE_BATCH_SIZE` symbols.
 */
const PRIORITY_PATHS: ReadonlySet<string> = new Set([QUOTE_PATH]);

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

/**
 * Assumed, not measured: an exchange renames, reclassifies or moves a listing
 * far less often than hourly, and a search typed again within the hour spends
 * none of the plan's request quota.
 */
const LISTING_TIME_TO_LIVE_MS = 3_600_000;

/**
 * Assumed, not measured: searched symbols come from users and not from what is
 * stored, so the listing cache is bounded by count, dropping the oldest entry.
 * It keeps each provider symbol a search asks for, five for a search in every
 * market, so this is a thousand such searches.
 */
const LISTING_CACHE_MAX_ENTRIES = 5_000;

/**
 * Assumed, not measured: a range the provider answered with no prices (a
 * weekend, a holiday, the days before a listing) stays without them, and the
 * history services ask for such an edge of a stored series on every read that
 * misses it. It is answered empty again for this long without a request, and a
 * close the provider publishes late is picked up once it expires.
 */
const EMPTY_HISTORY_TIME_TO_LIVE_MS = 3_600_000;

/**
 * Assumed, not measured: the ranges come from callers, so the empty histories
 * kept are bounded by count, dropping the oldest entry.
 */
const EMPTY_HISTORY_CACHE_MAX_ENTRIES = 10_000;

/**
 * Assumed, not measured: statements change once a quarter, and within the hour
 * the price moves the multiples and the yield by less than a reader of
 * fundamentals acts on; a page reloaded within it spends none of the plan's
 * request quota.
 */
const FUNDAMENTALS_TIME_TO_LIVE_MS = 3_600_000;

const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const PERCENT = 100;
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

const DAILY_RATE_INTERVAL: PriceInterval = '1d';

/**
 * A pause the provider asks for in `Retry-After` is kept within these bounds,
 * so a malformed or extreme header neither retries at once nor leaves quotes
 * off for more than an hour.
 */
const RETRY_AFTER_BOUNDS_MS = { min: 1_000, max: 3_600_000 } as const;

/**
 * Assumed, not documented: the key goes in the header an AWS API Gateway
 * reads, and such a gateway refuses with one of these messages a request sent
 * too fast and one past the plan's quota. Only which limit it was is logged,
 * never the body, which comes from the provider.
 */
const LIMIT_BY_THROTTLE_MESSAGE: ReadonlyMap<string, 'rate' | 'quota'> =
  new Map([
    ['Too Many Requests', 'rate'],
    ['Limit Exceeded', 'quota']
  ]);

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

/** The venue codes Yahoo reports for each known market; a listing on any other venue is left out. */
const MARKET_BY_EXCHANGE: ReadonlyMap<string, Market> = new Map([
  ['SAO', Markets.B3],
  ['NYQ', Markets.NYSE],
  ['ASE', Markets.NYSE],
  ['PCX', Markets.NYSE],
  ['NMS', Markets.NASDAQ],
  ['NGM', Markets.NASDAQ],
  ['NCM', Markets.NASDAQ],
  ['CCC', Markets.CRYPTO]
]);

const INSTRUMENT_TYPE_BY_QUOTE_TYPE: ReadonlyMap<string, InstrumentType> =
  new Map([
    ['EQUITY', InstrumentTypes.STOCK],
    ['ETF', InstrumentTypes.ETF],
    ['MUTUALFUND', InstrumentTypes.FUND],
    ['CRYPTOCURRENCY', InstrumentTypes.CRYPTO]
  ]);

/** Only equities have a sector, so no other listing spends a profile request. */
const SECTORED_TYPES: ReadonlySet<InstrumentType> = new Set([
  InstrumentTypes.STOCK,
  InstrumentTypes.REIT
]);

/** A fund has no statements, so a request for its yield alone asks for its summary alone. */
const FUNDAMENTALS_MODULE_BY_METRIC: Record<
  FundamentalMetric,
  typeof FINANCIAL_DATA_MODULE | typeof SUMMARY_DETAIL_MODULE
> = {
  priceToEarnings: SUMMARY_DETAIL_MODULE,
  dividendYield: SUMMARY_DETAIL_MODULE,
  returnOnEquity: FINANCIAL_DATA_MODULE,
  profitMargin: FINANCIAL_DATA_MODULE,
  debtToEquity: FINANCIAL_DATA_MODULE,
  revenueGrowth: FINANCIAL_DATA_MODULE,
  earningsGrowth: FINANCIAL_DATA_MODULE,
  freeCashFlow: FINANCIAL_DATA_MODULE
};

/**
 * B3 lists its real estate funds (FII) as equities, and only the legal name,
 * "Fundo de Investimento Imobiliário", or the `FII` abbreviation tells them
 * apart from stocks.
 */
const REAL_ESTATE_FUND_NAME_PATTERN = /\bFII\b|imobili[aá]ri/i;

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

const ListingNameSchema = z.string().trim().min(1).optional().catch(undefined);

const ListingSchema = z.object({
  currency: CurrencySchema,
  quoteType: z.string(),
  exchange: z.string(),
  longName: ListingNameSchema,
  shortName: ListingNameSchema
});

const ThrottleSchema = z.object({ message: z.string() });

const ProfileSchema = z.object({
  quoteSummary: z.object({
    result: z.tuple([
      z.object({
        [PROFILE_MODULE]: z.object({
          sector: z
            .string()
            .trim()
            .min(1)
            .max(InstrumentLimits.SECTOR_MAX_LENGTH)
            .optional()
            .catch(undefined)
        })
      })
    ])
  })
});

/**
 * The API wraps a number as `{ raw, fmt }` and answers `{}` for a figure it does
 * not report; a bare number is read as well. A figure outside either shape is
 * not reported, so it never takes the other figures down with it.
 */
const ReportedNumberSchema = z
  .union([
    z.number(),
    z.object({ raw: z.number() }).transform(({ raw }) => raw)
  ])
  .optional()
  .catch(undefined);

const FundamentalsSchema = z.object({
  quoteSummary: z.object({
    result: z.tuple([
      z.object({
        [FINANCIAL_DATA_MODULE]: z
          .object({
            financialCurrency: CurrencySchema.optional().catch(undefined),
            returnOnEquity: ReportedNumberSchema,
            profitMargins: ReportedNumberSchema,
            debtToEquity: ReportedNumberSchema,
            revenueGrowth: ReportedNumberSchema,
            earningsGrowth: ReportedNumberSchema,
            freeCashflow: ReportedNumberSchema
          })
          .optional(),
        [SUMMARY_DETAIL_MODULE]: z
          .object({
            trailingPE: ReportedNumberSchema,
            trailingAnnualDividendYield: ReportedNumberSchema,
            yield: ReportedNumberSchema
          })
          .optional()
      })
    ])
  })
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

type ListingItem = z.infer<typeof ListingSchema>;

/** What the provider answered for one of its symbols, null when it listed nothing under it. */
type CachedListingItem = {
  item: ListingItem | null;
  cachedAt: number;
};

type ListingItemsResponse =
  | { outcome: 'responded'; items: ReadonlyMap<string, ListingItem> }
  | typeof UNAVAILABLE;

type CachedEmptyHistory = {
  outcome: 'quoted' | 'not-found';
  cachedAt: number;
};

type FundamentalsModules = z.infer<
  typeof FundamentalsSchema
>['quoteSummary']['result'][0];

type FundamentalsResponse =
  { outcome: 'found'; modules: FundamentalsModules } | typeof NOT_FOUND;

type CachedFundamentals = {
  response: FundamentalsResponse;
  cachedAt: number;
};

type ListingCandidate = Record<'yahooSymbol' | 'currency', string> &
  Record<'market', Market>;

/**
 * `pause` leaves the provider alone for `FAILURE_COOLDOWN_MS`, as any quote
 * failure does; `report` only logs it, for an optional answer from an endpoint
 * the plan may not include, which must not take quotes down with it. A 429
 * pauses either way: the limit is the account's, not the endpoint's.
 */
type FailureHandling = 'pause' | 'report';

type RequestQueue = 'priority' | 'regular';

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

/**
 * The symbol under every market, and under every looked-up currency where the
 * pair names one; with a currency, only where it would be quoted in it.
 */
const listingCandidatesOf = (
  symbol: string,
  currency: string | null
): ListingCandidate[] =>
  Object.values(Markets).flatMap((market) => {
    const quoteCurrency = MarketQuoteCurrencies[market];
    const currencies: ReadonlyArray<string> =
      quoteCurrency === null ? CryptoListingCurrencies : [quoteCurrency];

    return currencies
      .filter((quoted) => currency === null || quoted === currency)
      .map((quoted) => ({
        market,
        currency: quoted,
        yahooSymbol: YAHOO_SYMBOL_BY_MARKET[market](symbol, quoted)
      }));
  });

/** Bounded by code points, so a surrogate pair is never split. */
const toListingName = (name: string) =>
  [...name.replace(/\s+/g, ' ')]
    .slice(0, InstrumentLimits.NAME_MAX_LENGTH)
    .join('')
    .trimEnd();

/** A candidate is listed only where the venue and the currency the provider reports are its own. */
const toListing = (
  symbol: string,
  { market, currency }: ListingCandidate,
  item: ListingItem | null
): Listing | null => {
  if (item === null) return null;

  const { longName, shortName, quoteType, exchange } = item;
  const name = longName ?? shortName;
  const quotedType = INSTRUMENT_TYPE_BY_QUOTE_TYPE.get(quoteType);

  if (
    name === undefined ||
    quotedType === undefined ||
    MARKET_BY_EXCHANGE.get(exchange) !== market ||
    item.currency !== currency
  )
    return null;

  const isRealEstateFund =
    market === Markets.B3 &&
    quotedType === InstrumentTypes.STOCK &&
    REAL_ESTATE_FUND_NAME_PATTERN.test(`${longName} ${shortName}`);

  return {
    symbol,
    name: toListingName(name),
    type: isRealEstateFund ? InstrumentTypes.REIT : quotedType,
    market,
    currency
  };
};

/** A search is unavailable when the provider never answered one of the symbols it asks for. */
const searchOf = (
  symbol: string,
  candidates: ReadonlyArray<ListingCandidate>,
  items: ReadonlyMap<string, ListingItem | null>
): ListingSearch =>
  candidates.every(({ yahooSymbol }) => items.has(yahooSymbol))
    ? {
        outcome: 'searched',
        listings: candidates.flatMap(
          (candidate) =>
            toListing(
              symbol,
              candidate,
              items.get(candidate.yahooSymbol) ?? null
            ) ?? []
        )
      }
    : UNAVAILABLE;

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

const decimalOf = (value: number | undefined) =>
  value === undefined ? undefined : new Prisma.Decimal(value);

/**
 * Yahoo reports debt to equity in percent, as `150.2` for 1.502 times, so it is
 * answered as the multiple the price to earnings is. A fund reports its yield
 * as `yield` and a company as `trailingAnnualDividendYield`, both what the last
 * 12 months paid over the price. Free cash flow is in the currency of the
 * statements, which may not be the quote's, so it is left out without one.
 */
const toReportedFundamentals = (
  { financialData, summaryDetail }: FundamentalsModules,
  metrics: ReadonlyArray<FundamentalMetric>
) => {
  const ratios: Record<FundamentalRatio, Prisma.Decimal | undefined> = {
    priceToEarnings: decimalOf(summaryDetail?.trailingPE),
    dividendYield: decimalOf(
      summaryDetail?.trailingAnnualDividendYield ?? summaryDetail?.yield
    ),
    returnOnEquity: decimalOf(financialData?.returnOnEquity),
    profitMargin: decimalOf(financialData?.profitMargins),
    debtToEquity: decimalOf(financialData?.debtToEquity)?.dividedBy(PERCENT),
    revenueGrowth: decimalOf(financialData?.revenueGrowth),
    earningsGrowth: decimalOf(financialData?.earningsGrowth)
  };
  const freeCashFlow = decimalOf(financialData?.freeCashflow);
  const statementCurrency = financialData?.financialCurrency;
  const reported: ReportedFundamentals = {};

  for (const metric of metrics) {
    if (metric === 'freeCashFlow') {
      if (freeCashFlow !== undefined && statementCurrency !== undefined)
        reported.freeCashFlow = {
          amount: freeCashFlow.toFixed(),
          currency: statementCurrency
        };
    } else {
      const ratio = ratios[metric];

      if (ratio !== undefined) reported[metric] = ratio.toFixed();
    }
  }

  return reported;
};

const inBatches = <Item>(items: ReadonlyArray<Item>, size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size)
  );

/** In seconds or as an HTTP date, as `Retry-After` may be written; null when absent or unreadable. */
const retryAfterMsOf = (header: string | null, now: number) => {
  const value = header?.trim() ?? '';
  const delayMs = /^\d+$/.test(value)
    ? Number(value) * MILLISECONDS_PER_SECOND
    : Date.parse(value) - now;

  return Number.isNaN(delayMs)
    ? null
    : Math.min(
        Math.max(delayMs, RETRY_AFTER_BOUNDS_MS.min),
        RETRY_AFTER_BOUNDS_MS.max
      );
};

/** Sets the entry as the newest, first dropping the oldest when the cache is full. */
const cacheWithinBound = <Entry>(
  cache: Map<string, Entry>,
  key: string,
  entry: Entry,
  maxEntries: number
) => {
  cache.delete(key);

  if (cache.size >= maxEntries) {
    const [oldestKey] = cache.keys();

    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  cache.set(key, entry);
};

/**
 * `MarketDataProvider` over the YH Finance API. The key goes only in the header
 * of requests to its fixed origin, and a redirect is refused so it is never
 * sent elsewhere. Quotes are cached for `QUOTE_TIME_TO_LIVE_MS` and a symbol
 * already being requested joins that request; when the provider fails, the
 * last quote received is answered, with the timestamp it was observed at. A
 * history range already being requested joins that request, and one answered
 * with no prices is answered so again for `EMPTY_HISTORY_TIME_TO_LIVE_MS`.
 * Fundamentals are cached for `FUNDAMENTALS_TIME_TO_LIVE_MS`. The quote and
 * fundamentals caches hold only symbols translated from stored instruments and
 * from pairs of stored currency codes, so they are bounded by what is stored;
 * the listing and empty-history caches hold what callers ask for, so they are
 * bounded by count. All of them live in this process, as does the turn each
 * request waits for: no more than `MAX_CONCURRENT_REQUESTS` are sent at once,
 * and the ones past it are sent as others finish, quotes first.
 */
export class YahooFinanceProvider implements MarketDataProvider {
  private static INSTANCE: YahooFinanceProvider;
  private readonly apiKey: string | undefined;
  private readonly fetchResponse: typeof fetch;
  private readonly now: () => number;
  private readonly logEntry: LogSink;
  private readonly quoteCache = new Map<string, CachedQuote>();
  private readonly inFlightQuotes = new Map<string, Promise<QuoteLookup>>();
  private readonly listingCache = new Map<string, CachedListingItem>();
  private readonly emptyHistoryCache = new Map<string, CachedEmptyHistory>();
  private readonly fundamentalsCache = new Map<string, CachedFundamentals>();
  private readonly inFlightHistories = new Map<
    string,
    Promise<PriceHistoryLookup>
  >();
  private readonly waitingRequests: Record<RequestQueue, Array<() => void>> = {
    priority: [],
    regular: []
  };
  private activeRequests = 0;
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

  /**
   * The provider symbols of every search are asked for together, up to
   * `QUOTE_BATCH_SIZE` a request, and each answer is kept for
   * `LISTING_TIME_TO_LIVE_MS`; one the provider fails to give is the last
   * received for that symbol, however old.
   */
  async findListings(
    currencyBySymbol: ReadonlyMap<string, string | null>
  ): Promise<ReadonlyMap<string, ListingSearch>> {
    const candidatesBySymbol = new Map(
      [...currencyBySymbol].map(([symbol, currency]) => [
        symbol,
        QUOTABLE_SYMBOL_PATTERN.test(symbol)
          ? listingCandidatesOf(symbol, currency)
          : []
      ])
    );
    const items = await this.lookUpListingItems([
      ...new Set(
        [...candidatesBySymbol.values()].flatMap((candidates) =>
          candidates.map(({ yahooSymbol }) => yahooSymbol)
        )
      )
    ]);

    return new Map(
      [...candidatesBySymbol].map(([symbol, candidates]) => [
        symbol,
        searchOf(symbol, candidates, items)
      ])
    );
  }

  async describeListing(instrument: PricedInstrument): Promise<ListingLookup> {
    const { symbol, currency } = instrument;
    const search = (await this.findListings(new Map([[symbol, currency]]))).get(
      symbol
    );

    if (search === undefined || search.outcome === 'unavailable')
      return UNAVAILABLE;

    const listing = search.listings.find(
      ({ market, currency }) =>
        market === instrument.market && currency === instrument.currency
    );

    if (listing === undefined) return NOT_FOUND;

    const yahooSymbol = toYahooSymbol(listing);
    const sector =
      SECTORED_TYPES.has(listing.type) && yahooSymbol !== null
        ? await this.lookUpSector(yahooSymbol)
        : null;

    return { outcome: 'listed', listing: { ...listing, sector } };
  }

  async getFundamentals(
    instrument: PricedInstrument,
    metrics: ReadonlyArray<FundamentalMetric>
  ): Promise<FundamentalsLookup> {
    const yahooSymbol = toYahooSymbol(instrument);

    if (yahooSymbol === null) return NOT_FOUND;

    const modules = [
      ...new Set(metrics.map((metric) => FUNDAMENTALS_MODULE_BY_METRIC[metric]))
    ]
      .toSorted()
      .join(',');

    if (modules === '')
      return {
        outcome: 'reported',
        fundamentals: {},
        source: YAHOO_FINANCE_SOURCE
      };

    const response = await this.lookUpFundamentals(yahooSymbol, modules);

    if (response.outcome !== 'found') return response;

    return {
      outcome: 'reported',
      fundamentals: toReportedFundamentals(response.modules, metrics),
      source: YAHOO_FINANCE_SOURCE
    };
  }

  /** Answers only the symbols answered now or before; a search missing one is unavailable. */
  private async lookUpListingItems(yahooSymbols: ReadonlyArray<string>) {
    const items = new Map<string, ListingItem | null>();
    const unrequested: string[] = [];

    for (const yahooSymbol of yahooSymbols) {
      const cached = this.listingCache.get(yahooSymbol);

      if (
        cached !== undefined &&
        this.now() - cached.cachedAt < LISTING_TIME_TO_LIVE_MS
      )
        items.set(yahooSymbol, cached.item);
      else unrequested.push(yahooSymbol);
    }

    await Promise.all(
      inBatches(unrequested, QUOTE_BATCH_SIZE).map(async (batch) => {
        const received = await this.requestListingItems(batch);

        for (const yahooSymbol of batch) {
          if (received.outcome === 'unavailable') {
            const last = this.listingCache.get(yahooSymbol);

            if (last !== undefined) items.set(yahooSymbol, last.item);
          } else {
            const item = received.items.get(yahooSymbol) ?? null;

            cacheWithinBound(
              this.listingCache,
              yahooSymbol,
              { item, cachedAt: this.now() },
              LISTING_CACHE_MAX_ENTRIES
            );
            items.set(yahooSymbol, item);
          }
        }
      })
    );

    return items;
  }

  /** A symbol the provider leaves out of its answer, or answers outside the expected shape, lists nothing. */
  private async requestListingItems(
    batch: ReadonlyArray<string>
  ): Promise<ListingItemsResponse> {
    const response = await this.request(QUOTE_PATH, {
      symbols: batch.join(',')
    });

    if (response.outcome === 'unavailable') return UNAVAILABLE;
    if (response.outcome === 'not-found')
      return { outcome: 'responded', items: new Map() };

    const envelope = QuoteEnvelopeSchema.safeParse(response.body);

    if (!envelope.success) return this.reportFailure('invalid quote response');

    return {
      outcome: 'responded',
      items: new Map(
        envelope.data.quoteResponse.result.flatMap((item) => {
          const listing = ListingSchema.safeParse(item);

          return listing.success ? [[item.symbol, listing.data] as const] : [];
        })
      )
    };
  }

  /** The sector is optional, so a profile the provider does not answer is none. */
  private async lookUpSector(yahooSymbol: string) {
    const response = await this.request(
      `${QUOTE_SUMMARY_PATH}${encodeURIComponent(yahooSymbol)}`,
      { modules: PROFILE_MODULE },
      'report'
    );

    if (response.outcome !== 'responded') return null;

    const profile = ProfileSchema.safeParse(response.body);

    if (!profile.success) {
      this.reportFailure('invalid profile response', 'report');
      return null;
    }

    return profile.data.quoteSummary.result[0][PROFILE_MODULE].sector ?? null;
  }

  private async lookUpFundamentals(yahooSymbol: string, modules: string) {
    const fundamentalsKey = `${yahooSymbol} ${modules}`;
    const cached = this.fundamentalsCache.get(fundamentalsKey);

    if (
      cached !== undefined &&
      this.now() - cached.cachedAt < FUNDAMENTALS_TIME_TO_LIVE_MS
    )
      return cached.response;

    const response = await this.requestFundamentals(yahooSymbol, modules);

    if (response.outcome !== 'unavailable')
      this.fundamentalsCache.set(fundamentalsKey, {
        response,
        cachedAt: this.now()
      });

    return response;
  }

  /** The figures are optional, so a failure is reported without leaving quotes alone. */
  private async requestFundamentals(
    yahooSymbol: string,
    modules: string
  ): Promise<FundamentalsResponse | typeof UNAVAILABLE> {
    const response = await this.request(
      `${QUOTE_SUMMARY_PATH}${encodeURIComponent(yahooSymbol)}`,
      { modules },
      'report'
    );

    if (response.outcome !== 'responded') return response;

    const summary = FundamentalsSchema.safeParse(response.body);

    if (!summary.success)
      return this.reportFailure('invalid fundamentals response', 'report');

    return { outcome: 'found', modules: summary.data.quoteSummary.result[0] };
  }

  private async lookUpPriceHistory(
    yahooSymbol: string,
    range: PriceRange,
    interval: PriceInterval
  ): Promise<PriceHistoryLookup> {
    const { from, to } = range;

    if (from.getTime() >= to.getTime())
      return { outcome: 'quoted', prices: [] };

    const lookbackDays = LOOKBACK_DAYS.get(interval);

    if (
      lookbackDays !== undefined &&
      from.getTime() < this.now() - lookbackDays * MILLISECONDS_PER_DAY
    )
      return { outcome: 'range-not-served' };

    const historyKey = [
      yahooSymbol,
      interval,
      from.toISOString(),
      to.toISOString()
    ].join(' ');
    const cached = this.emptyHistoryCache.get(historyKey);

    if (
      cached !== undefined &&
      this.now() - cached.cachedAt < EMPTY_HISTORY_TIME_TO_LIVE_MS
    )
      return cached.outcome === 'not-found'
        ? NOT_FOUND
        : { outcome: 'quoted', prices: [] };

    const inFlight = this.inFlightHistories.get(historyKey);

    if (inFlight !== undefined) return inFlight;

    const lookup = this.requestPriceHistory(yahooSymbol, range, interval)
      .then((history) => {
        if (
          history.outcome === 'not-found' ||
          (history.outcome === 'quoted' && history.prices.length === 0)
        )
          cacheWithinBound(
            this.emptyHistoryCache,
            historyKey,
            { outcome: history.outcome, cachedAt: this.now() },
            EMPTY_HISTORY_CACHE_MAX_ENTRIES
          );

        return history;
      })
      .finally(() => this.inFlightHistories.delete(historyKey));

    this.inFlightHistories.set(historyKey, lookup);

    return lookup;
  }

  private async requestPriceHistory(
    yahooSymbol: string,
    { from, to }: PriceRange,
    interval: PriceInterval
  ): Promise<PriceHistoryLookup> {
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
      return this.reportingFallbacks(
        new Map(
          batch.map((yahooSymbol) => [
            yahooSymbol,
            this.lastQuoteOf(yahooSymbol)
          ])
        )
      );

    const receivedAt = this.now();
    const itemsBySymbol = new Map(
      envelope.data.quoteResponse.result.map((item) => [item.symbol, item])
    );

    return this.reportingFallbacks(
      new Map(
        batch.map((yahooSymbol) => {
          const item = itemsBySymbol.get(yahooSymbol);
          const quote = item && QuoteSchema.safeParse(item);

          if (quote?.success === false)
            return [yahooSymbol, this.lastQuoteOf(yahooSymbol)];

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
      )
    );
  }

  /** The last quote received for a symbol, marked as standing in for one the provider failed to give. */
  private lastQuoteOf(yahooSymbol: string): QuoteLookup {
    const lookup = this.quoteCache.get(yahooSymbol)?.lookup;

    if (lookup === undefined) return UNAVAILABLE;

    return lookup.outcome === 'quoted'
      ? { ...lookup, isFallback: true }
      : lookup;
  }

  private reportingFallbacks(lookups: ReadonlyMap<string, QuoteLookup>) {
    const count = [...lookups.values()].filter(
      (lookup) => lookup.outcome === 'quoted' && lookup.isFallback === true
    ).length;

    if (count > 0)
      this.logEntry({
        severity: LogSeverities.WARNING,
        event: 'quote_provider_fallback_served',
        count
      });

    return lookups;
  }

  /** A pause that starts while a request waits for its turn is kept too, without sending it. */
  private async request(
    path: string,
    query: Record<string, string>,
    failureHandling: FailureHandling = 'pause'
  ): Promise<ProviderResponse> {
    const { apiKey } = this;

    if (apiKey === undefined || this.isPaused()) return UNAVAILABLE;

    return this.inTurn(
      PRIORITY_PATHS.has(path) ? 'priority' : 'regular',
      async () =>
        this.isPaused()
          ? UNAVAILABLE
          : this.send(apiKey, path, query, failureHandling)
    );
  }

  private isPaused() {
    return this.now() < this.unavailableUntil;
  }

  /** Runs `task` once fewer than `MAX_CONCURRENT_REQUESTS` run, then hands its turn to the next waiting. */
  private async inTurn<Result>(
    queue: RequestQueue,
    task: () => Promise<Result>
  ): Promise<Result> {
    if (this.activeRequests < MAX_CONCURRENT_REQUESTS) this.activeRequests += 1;
    else
      await new Promise<void>((resolve) => {
        this.waitingRequests[queue].push(resolve);
      });

    try {
      return await task();
    } finally {
      const next =
        this.waitingRequests.priority.shift() ??
        this.waitingRequests.regular.shift();

      if (next === undefined) this.activeRequests -= 1;
      else next();
    }
  }

  private async send(
    apiKey: string,
    path: string,
    query: Record<string, string>,
    failureHandling: FailureHandling
  ): Promise<ProviderResponse> {
    const url = new URL(path, YAHOO_FINANCE_ORIGIN);
    url.search = new URLSearchParams(query).toString();

    try {
      const response = await this.fetchResponse(url, {
        headers: { 'x-api-key': apiKey, accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (response.status === HTTP_NOT_FOUND) {
        await response.body?.cancel();
        return NOT_FOUND;
      }

      if (response.status === HTTP_TOO_MANY_REQUESTS)
        return await this.pauseThrottled(response);

      if (!response.ok) {
        await response.body?.cancel();
        return this.reportFailure(`status ${response.status}`, failureHandling);
      }

      return { outcome: 'responded', body: await response.json() };
    } catch (error) {
      return this.reportFailure(
        error instanceof Error ? error.name : 'unknown error',
        failureHandling
      );
    }
  }

  /**
   * Every request is paused for as long as the provider asks or, when it does
   * not say, for `FAILURE_COOLDOWN_MS`; a longer pause already running stays.
   */
  private async pauseThrottled(
    response: Response
  ): Promise<typeof UNAVAILABLE> {
    const retryInMs =
      retryAfterMsOf(response.headers.get('retry-after'), this.now()) ??
      FAILURE_COOLDOWN_MS;
    const throttle = ThrottleSchema.safeParse(
      await response.json().catch(() => null)
    );
    const limit = throttle.success
      ? LIMIT_BY_THROTTLE_MESSAGE.get(throttle.data.message)
      : undefined;

    this.unavailableUntil = Math.max(
      this.unavailableUntil,
      this.now() + retryInMs
    );
    this.logEntry({
      severity: LogSeverities.WARNING,
      event: 'quote_provider_unavailable',
      reason: `status ${HTTP_TOO_MANY_REQUESTS}`,
      ...(limit !== undefined && { limit }),
      retryInMs
    });

    return UNAVAILABLE;
  }

  private reportFailure(
    reason: string,
    failureHandling: FailureHandling = 'pause'
  ): typeof UNAVAILABLE {
    if (failureHandling === 'report') {
      this.logEntry({
        severity: LogSeverities.WARNING,
        event: 'quote_provider_request_failed',
        reason
      });

      return UNAVAILABLE;
    }

    this.unavailableUntil = Math.max(
      this.unavailableUntil,
      this.now() + FAILURE_COOLDOWN_MS
    );
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
