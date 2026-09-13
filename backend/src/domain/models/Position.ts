import type { Instrument } from './Instrument';

/** Quantities and monetary values are decimal strings, exact to the scale of their columns. */
export type Position = {
  id: string;
  symbol: Instrument['symbol'];
  quantity: string;
  averageCost: string;
  investedValue: string;
  portfolioId: string;
  instrumentId: string;
};
