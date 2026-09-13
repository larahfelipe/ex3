import type { Instrument } from './Instrument';

export type Position = {
  id: string;
  symbol: Instrument['symbol'];
  quantity: number;
  averageCost: number;
  balance: number;
  portfolioId: string;
  instrumentId: string;
};
