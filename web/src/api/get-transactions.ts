import { api } from '@/lib/axios';

export type TransactionType = 'BUY' | 'SELL';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
  assetId: string;
};

type GetTransactionsResponse = Record<'transactions', Array<Transaction>>;

export const getTransactions = async (assetId: string) =>
  await api.get<GetTransactionsResponse>(`/v1/transactions/${assetId}`);
