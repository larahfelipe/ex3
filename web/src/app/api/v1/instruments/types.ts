import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { Maybe, WithId, WithTimestamps } from '@/types';

export type InstrumentProperties = Record<'symbol' | 'name', string> &
  Record<'type', InstrumentType> &
  Record<'market' | 'currency' | 'sector' | 'country', Maybe<string>>;

/** `PRIVATE` instruments were registered by the caller and are seen by no one else. */
export type InstrumentScope = 'CATALOG' | 'PRIVATE';

export type Instrument = WithId &
  WithTimestamps &
  InstrumentProperties &
  Record<'scope', InstrumentScope>;

/** An instrument the quote provider lists and the caller does not track yet. */
export type Listing = Pick<InstrumentProperties, 'symbol' | 'name' | 'type'> &
  Record<'market' | 'currency', string>;

export type ListingReference = Pick<Listing, 'market' | 'currency'>;

/**
 * `SKIPPED` when the term cannot be a symbol or names an instrument the caller
 * already sees, so the quote provider was not asked.
 */
export type MarketSearchStatus = 'SEARCHED' | 'SKIPPED' | 'UNAVAILABLE';

export type SearchInstrumentsRequestParams = Record<'query', string>;

export type SearchInstrumentsResponseData = {
  instruments: Array<Instrument>;
  listings: Array<Listing>;
  marketSearch: MarketSearchStatus;
};
