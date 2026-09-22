import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { Maybe, Pagination, WithId, WithTimestamps } from '@/types';

export type InstrumentProperties = Record<'symbol' | 'name', string> &
  Record<'type', InstrumentType> &
  Record<'market' | 'currency' | 'sector' | 'country', Maybe<string>>;

/** `PRIVATE` instruments were registered by the caller and are seen by no one else. */
export type InstrumentScope = 'CATALOG' | 'PRIVATE';

export interface Instrument
  extends WithId, WithTimestamps, InstrumentProperties {
  scope: InstrumentScope;
}

export type GetInstrumentsRequestParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type GetInstrumentsResponseData = {
  instruments: Array<Instrument>;
  pagination: Pagination;
};

/** A null currency means the market takes any, as a crypto pair does. */
export type InstrumentMarketOption = {
  market: string;
  currency: Maybe<string>;
};

/** Types are strings, not `InstrumentType`: the API may offer one this client does not know yet. */
export type GetInstrumentOptionsResponseData = {
  types: Array<string>;
  markets: Array<InstrumentMarketOption>;
};

export type InstrumentRegistrationPayload = Record<
  'name' | 'type' | 'market' | 'currency',
  string
> & {
  sector?: string;
};
