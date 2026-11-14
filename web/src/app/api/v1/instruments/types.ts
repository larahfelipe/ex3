import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { Maybe, WithId, WithTimestamps } from '@/types';

export type InstrumentProperties = Record<'symbol' | 'name', string> &
  Record<'type', InstrumentType> &
  Record<'market' | 'currency' | 'sector' | 'country', Maybe<string>>;

export type InstrumentScope = 'CATALOG' | 'PRIVATE';

export type Instrument = WithId &
  WithTimestamps &
  InstrumentProperties &
  Record<'scope', InstrumentScope>;

export type Listing = Pick<InstrumentProperties, 'symbol' | 'name' | 'type'> &
  Record<'market' | 'currency', string>;

export type ListingReference = Pick<Listing, 'market' | 'currency'>;

export type MarketSearchStatus = 'SEARCHED' | 'SKIPPED' | 'UNAVAILABLE';

export type SearchInstrumentsRequestParams = Record<'query', string>;

export type SearchInstrumentsResponseData = {
  instruments: Array<Instrument>;
  listings: Array<Listing>;
  marketSearch: MarketSearchStatus;
};
