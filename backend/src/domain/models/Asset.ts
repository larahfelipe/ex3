import type { Instrument } from './Instrument';

export type Asset = {
  id: string;
  symbol: Instrument['symbol'];
  amount: number;
  balance: number;
  portfolioId: string;
  instrumentId: string;
};
