export type InstrumentType =
  | 'STOCK'
  | 'ETF'
  | 'FUND'
  | 'REIT'
  | 'CRYPTO'
  | 'BOND'
  | 'TREASURY'
  | 'CASH'
  | 'OTHER';

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  type: InstrumentType;
  market: string | null;
  currency: string | null;
  sector: string | null;
  country: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Market and currency are required from registration on, so every new instrument can be quoted. */
export type InstrumentRegistration = Pick<
  Instrument,
  'symbol' | 'name' | 'type'
> &
  Record<'market' | 'currency', string> &
  Partial<Record<'sector' | 'country', string>>;
