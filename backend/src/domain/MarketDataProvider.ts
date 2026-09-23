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
  { outcome: 'quoted'; quote: Quote } | MarketDataFailure;

export type PriceHistoryLookup =
  | { outcome: 'quoted'; prices: ObservedPrice[] }
  | { outcome: 'range-not-served' }
  | MarketDataFailure;

/** An instrument as the provider lists it, in one of the known markets. */
export type Listing = Pick<Instrument, 'symbol' | 'name' | 'type'> &
  Record<'market' | 'currency', string>;

export type ListingSearch =
  { outcome: 'searched'; listings: Listing[] } | { outcome: 'unavailable' };

export type ListingLookup =
  | { outcome: 'listed'; listing: Listing & Pick<Instrument, 'sector'> }
  | MarketDataFailure;

/**
 * Where the domain gets market prices without depending on a provider SDK. An
 * instrument is priced by its catalog symbol, market and quote currency, which
 * an implementation translates into the provider's own code; an instrument it
 * cannot translate is `not-found`. `getQuotes` answers the latest price of each
 * instrument, with one entry per symbol asked for and the previous close when
 * the provider has one. `getExchangeRates` answers, with one entry per currency
 * asked for, the price of one unit of it in `baseCurrency`; a currency without a
 * pair to `baseCurrency`, itself included, is `not-found`. `getHistoricalPrices`
 * answers the closing price of every `interval` starting from `range.from`,
 * inclusive, to `range.to`, exclusive, timestamped at the start of the interval
 * and in ascending order, or `range-not-served` when the provider keeps no
 * prices that old at that interval. `getHistoricalExchangeRate` answers that
 * same series for a pair of currencies, the daily closing price of one unit of
 * `currency` in `baseCurrency`, on the terms `getExchangeRates` states for the
 * pair and `getHistoricalPrices` for the range. `findListings` answers every
 * instrument the provider lists under `symbol` in a known market, whose quote
 * currency is the market's or, where the pair names it, one of the currencies
 * crypto is looked up in; `describeListing` answers the one listed under the
 * symbol, market and currency given, with its sector when the provider has
 * one. Everything the provider returns is untrusted input, validated before it
 * is answered.
 */
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
  findListings: (symbol: string) => Promise<ListingSearch>;
  describeListing: (instrument: PricedInstrument) => Promise<ListingLookup>;
}
