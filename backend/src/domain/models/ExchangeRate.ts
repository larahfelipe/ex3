/** Monetary values are decimal strings, exact to the scale of their columns. */
export type ExchangeRate = {
  id: string;
  currency: string;
  baseCurrency: string;
  rate: string;
  source: string;
  timestamp: Date;
  createdAt: Date;
};
