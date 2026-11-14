import type { FundamentalMetric, ReportedFundamentals } from './Fundamentals';
import type { Instrument } from './models';

export type PricedInstrument = Pick<
  Instrument,
  'symbol' | 'market' | 'currency'
>;

export type ObservedPrice = {
  price: string;
  currency: string;
  timestamp: Date;
  source: string;
};

export type Quote = ObservedPrice & {
  previousClose?: string;
};

export type PriceRange = {
  from: Date;
  to: Date;
};

export type PriceInterval = '5m' | '15m' | '30m' | '1h' | '1d';

export type MarketDataFailure =
  { outcome: 'not-found' } | { outcome: 'unavailable' };

export type QuoteLookup =
  { outcome: 'quoted'; quote: Quote; isFallback?: boolean } | MarketDataFailure;

export type PriceHistoryLookup =
  | { outcome: 'quoted'; prices: ObservedPrice[] }
  | { outcome: 'range-not-served' }
  | MarketDataFailure;

export type Listing = Pick<Instrument, 'symbol' | 'name' | 'type'> &
  Record<'market' | 'currency', string>;

export type ListingSearch =
  { outcome: 'searched'; listings: Listing[] } | { outcome: 'unavailable' };

export type DescribedListing = Listing & Pick<Instrument, 'sector'>;

export type ListingLookup =
  { outcome: 'listed'; listing: DescribedListing } | MarketDataFailure;

export type FundamentalsLookup =
  | (Record<'outcome', 'reported'> &
      Record<'fundamentals', ReportedFundamentals> &
      Record<'source', string>)
  | MarketDataFailure;

export interface MarketDataProvider {
  getQuotes: (
    instruments: ReadonlyArray<PricedInstrument>
  ) => Promise<ReadonlyMap<string, QuoteLookup>>;
  getExchangeRates: (
    currencies: ReadonlyArray<string>,
    baseCurrency: string
  ) => Promise<ReadonlyMap<string, QuoteLookup>>;
  getHistoricalPrices: (
    instrument: PricedInstrument,
    range: PriceRange,
    interval: PriceInterval
  ) => Promise<PriceHistoryLookup>;
  getHistoricalExchangeRate: (
    currency: string,
    baseCurrency: string,
    range: PriceRange
  ) => Promise<PriceHistoryLookup>;
  findListings: (
    currencyBySymbol: ReadonlyMap<string, string | null>
  ) => Promise<ReadonlyMap<string, ListingSearch>>;
  describeListing: (instrument: PricedInstrument) => Promise<ListingLookup>;
  getFundamentals: (
    instrument: PricedInstrument,
    metrics: ReadonlyArray<FundamentalMetric>
  ) => Promise<FundamentalsLookup>;
}

export type ListingSource = Pick<
  MarketDataProvider,
  'findListings' | 'describeListing'
>;

export type ListingCatalogLookup =
  | { outcome: 'listed'; listings: ReadonlyMap<string, DescribedListing> }
  | { outcome: 'unavailable' };

export interface ListingCatalog {
  getListings: () => Promise<ListingCatalogLookup>;
}
