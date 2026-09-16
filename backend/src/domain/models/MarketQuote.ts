/** Monetary values are decimal strings, exact to the scale of their columns. */
export type MarketQuote = {
  id: string;
  price: string;
  currency: string;
  source: string;
  timestamp: Date;
  instrumentId: string;
  createdAt: Date;
};
