import { z } from 'zod';

import {
  InstrumentTypes,
  MarketQuoteCurrencies,
  Markets
} from '@/config/Constants';
import { envs } from '@/config/Envs';
import { isListableSymbol } from '@/domain/InstrumentCatalog';
import type {
  DescribedListing,
  ListingCatalog,
  ListingCatalogLookup
} from '@/domain/MarketDataProvider';
import type { InstrumentType } from '@/domain/models';
import { log, LogSeverities, type LogSink } from '@/infra/observability';

import {
  ListingNameSchema,
  retryAfterMsOf,
  SectorSchema,
  toListingName
} from './ProviderInput';

const BRAPI_ORIGIN = 'https://brapi.dev';
const TICKERS_PATH = '/api/v2/tickers';

/** The most tickers the API answers in one page. */
const TICKERS_PAGE_SIZE = 2_000;

/**
 * Assumed, not measured: B3 listed about 2,300 tickers in 2025, two pages.
 * Past this many pages the catalog keeps the ones read, and a symbol it lacks
 * is looked up as if there were no catalog.
 */
const MAX_TICKER_PAGES = 5;

/** Assumed, not measured: a page of 2,000 tickers is far larger than a quote, and it is read for an import, not a page load. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Assumed, not measured: B3 lists, delists and reclassifies tickers far less
 * often than daily, and a ticker listed since the catalog was read is looked
 * up as if there were no catalog. A day of imports reads the catalog once.
 */
const CATALOG_TIME_TO_LIVE_MS = 86_400_000;

/** Assumed, not measured: after a failure the API is left alone this long, so an import retried at once sends no request. */
const FAILURE_COOLDOWN_MS = 300_000;

const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * A unit, a certificate of shares, and a BDR, a receipt of a foreign share, are
 * shares as the quote provider lists them; a ticker of another kind is left
 * out.
 */
const INSTRUMENT_TYPE_BY_SUB_TYPE: ReadonlyMap<string, InstrumentType> =
  new Map([
    ['stock', InstrumentTypes.STOCK],
    ['unit', InstrumentTypes.STOCK],
    ['bdr', InstrumentTypes.STOCK],
    ['fii', InstrumentTypes.REIT],
    ['etf', InstrumentTypes.ETF],
    ['fi-infra', InstrumentTypes.FUND],
    ['fi-agro', InstrumentTypes.FUND],
    ['fip', InstrumentTypes.FUND],
    ['fidc', InstrumentTypes.FUND]
  ]);

const UNAVAILABLE = { outcome: 'unavailable' } as const;

const TickersPageSchema = z.object({
  results: z.array(z.unknown()).max(TICKERS_PAGE_SIZE),
  pagination: z.object({ hasNextPage: z.boolean() })
});

const TickerSchema = z.object({
  symbol: z.string(),
  name: ListingNameSchema,
  longName: ListingNameSchema,
  subType: z.string(),
  exchange: z.string(),
  currency: z.string(),
  sector: SectorSchema.nullish().catch(null),
  isActive: z.boolean()
});

type CachedCatalog = {
  listings: ReadonlyMap<string, DescribedListing>;
  readAt: number;
};

/** Only a ticker in trading, on B3 and in its currency, is listed. */
const toCatalogListing = (item: unknown): DescribedListing | null => {
  const ticker = TickerSchema.safeParse(item);

  if (!ticker.success) return null;

  const { symbol, name, longName, subType, exchange, currency, isActive } =
    ticker.data;
  const listedName = name ?? longName;
  const type = INSTRUMENT_TYPE_BY_SUB_TYPE.get(subType);

  if (
    !isActive ||
    listedName === undefined ||
    type === undefined ||
    exchange !== Markets.B3 ||
    currency !== MarketQuoteCurrencies.B3 ||
    !isListableSymbol(symbol)
  )
    return null;

  return {
    symbol,
    name: toListingName(listedName),
    type,
    market: Markets.B3,
    currency,
    sector: ticker.data.sector ?? null
  };
};

/**
 * `ListingCatalog` of B3 over brapi's ticker list, read in pages of
 * `TICKERS_PAGE_SIZE` ordered by symbol, one after another, since the free plan
 * answers one request at a time. Nothing is asked without a key; the key goes
 * only in the header of requests to its fixed origin, and a redirect is refused
 * so it is never sent elsewhere. The catalog is kept for
 * `CATALOG_TIME_TO_LIVE_MS`, in this process, and a read already running is
 * joined. When a read fails, a page of it included, the last catalog read is
 * answered, however old, and the API is left alone for the `Retry-After` of a
 * 429, or else for `FAILURE_COOLDOWN_MS`.
 */
export class BrapiTickerCatalog implements ListingCatalog {
  private static INSTANCE: BrapiTickerCatalog;
  private readonly apiKey: string | undefined;
  private readonly fetchResponse: typeof fetch;
  private readonly now: () => number;
  private readonly logEntry: LogSink;
  private catalog: CachedCatalog | null = null;
  private inFlightRead: Promise<void> | null = null;
  private unavailableUntil = 0;

  constructor({
    apiKey,
    fetchResponse = (input, init) => fetch(input, init),
    now = Date.now,
    logEntry = log
  }: BrapiTickerCatalog.Options) {
    this.apiKey = apiKey;
    this.fetchResponse = fetchResponse;
    this.now = now;
    this.logEntry = logEntry;
  }

  static getInstance() {
    if (!BrapiTickerCatalog.INSTANCE)
      BrapiTickerCatalog.INSTANCE = new BrapiTickerCatalog({
        apiKey: envs.brapiApiKey
      });

    return BrapiTickerCatalog.INSTANCE;
  }

  async getListings(): Promise<ListingCatalogLookup> {
    const { apiKey } = this;

    if (apiKey === undefined) return UNAVAILABLE;

    const isCurrent =
      this.catalog !== null &&
      this.now() - this.catalog.readAt < CATALOG_TIME_TO_LIVE_MS;

    if (!isCurrent && this.now() >= this.unavailableUntil)
      await this.readCatalog(apiKey);

    return this.catalog === null
      ? UNAVAILABLE
      : { outcome: 'listed', listings: this.catalog.listings };
  }

  private readCatalog(apiKey: string) {
    this.inFlightRead ??= this.requestCatalog(apiKey)
      .then((listings) => {
        if (listings === null) return;

        this.catalog = { listings, readAt: this.now() };
        this.logEntry({
          severity: LogSeverities.INFO,
          event: 'ticker_catalog_loaded',
          count: listings.size
        });
      })
      .finally(() => {
        this.inFlightRead = null;
      });

    return this.inFlightRead;
  }

  private async requestCatalog(apiKey: string) {
    const listings = new Map<string, DescribedListing>();

    for (let page = 1; page <= MAX_TICKER_PAGES; page += 1) {
      const tickers = await this.requestPage(apiKey, page);

      if (tickers === null) return null;

      for (const item of tickers.results) {
        const listing = toCatalogListing(item);

        if (listing !== null) listings.set(listing.symbol, listing);
      }

      if (!tickers.pagination.hasNextPage) break;
    }

    return listings;
  }

  private async requestPage(apiKey: string, page: number) {
    const url = new URL(TICKERS_PATH, BRAPI_ORIGIN);
    url.search = new URLSearchParams({
      page: String(page),
      limit: String(TICKERS_PAGE_SIZE),
      sortBy: 'symbol',
      sortOrder: 'asc'
    }).toString();

    try {
      const response = await this.fetchResponse(url, {
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json'
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        await response.body?.cancel();

        return this.pause(
          `status ${response.status}`,
          response.status === HTTP_TOO_MANY_REQUESTS
            ? retryAfterMsOf(response.headers.get('retry-after'), this.now())
            : null
        );
      }

      const tickers = TickersPageSchema.safeParse(await response.json());

      return tickers.success
        ? tickers.data
        : this.pause('invalid tickers response');
    } catch (error) {
      return this.pause(error instanceof Error ? error.name : 'unknown error');
    }
  }

  private pause(reason: string, retryAfterMs: number | null = null): null {
    const retryInMs = retryAfterMs ?? FAILURE_COOLDOWN_MS;

    this.unavailableUntil = this.now() + retryInMs;
    this.logEntry({
      severity: LogSeverities.WARNING,
      event: 'ticker_catalog_unavailable',
      reason,
      retryInMs
    });

    return null;
  }
}

namespace BrapiTickerCatalog {
  export type Options = {
    apiKey: string | undefined;
    fetchResponse?: typeof fetch;
    now?: () => number;
    logEntry?: LogSink;
  };
}
