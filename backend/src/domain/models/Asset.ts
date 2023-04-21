import type { Transaction } from './Transaction';

export type Asset = {
  id: string;
  symbol: string;
  transactions: Array<Transaction>;
};
