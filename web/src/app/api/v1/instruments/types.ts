import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { Maybe, Pagination, WithId, WithTimestamps } from '@/types';

export type InstrumentProperties = Record<'symbol' | 'name', string> &
  Record<'type', InstrumentType> &
  Record<'market' | 'currency' | 'sector' | 'country', Maybe<string>>;

export interface Instrument
  extends WithId, WithTimestamps, InstrumentProperties {}

export type GetInstrumentsRequestParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type GetInstrumentsResponseData = {
  instruments: Array<Instrument>;
  pagination: Pagination;
};
