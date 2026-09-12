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
  createdAt: Date;
  updatedAt: Date;
};
