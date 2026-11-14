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

const TICKERS_PAGE_SIZE = 2_000;

const MAX_TICKER_PAGES = 5;

const REQUEST_TIMEOUT_MS = 15_000;

const CATALOG_TIME_TO_LIVE_MS = 86_400_000;

const FAILURE_COOLDOWN_MS = 300_000;

const HTTP_TOO_MANY_REQUESTS = 429;

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
