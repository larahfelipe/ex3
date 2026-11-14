import type { Instrument } from './Instrument';

export type Position = {
  id: string;
  symbol: Instrument['symbol'];
  quantity: string;
  averageCost: string;
  investedValue: string;
  portfolioId: string;
  instrumentId: string;
};
