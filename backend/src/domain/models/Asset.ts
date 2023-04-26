import type { Transaction } from './Transaction';

export type Asset = {
  id: string;
  symbol: string;
  amount: number;
  balance: number;
  transactions: Array<Transaction>;
  portfolioId: string;
};
