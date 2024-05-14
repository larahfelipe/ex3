import { api } from '@/lib/axios';
import type { Pagination, WithId } from '@/types';
import type { Asset } from './get-assets';

export type TransactionType = 'BUY' | 'SELL';

export type TransactionProperties = {
  type: TransactionType;
  amount: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
  assetId: string;
};

export type GetTransactionPayload = Pick<Asset, 'symbol'>;

export interface Transaction extends WithId, TransactionProperties {}

type GetTransactionsResponse = {
  transactions: Array<Transaction>;
  pagination: Pagination;
};

export const getTransactions = async (payload: GetTransactionPayload) =>
  await api.get<GetTransactionsResponse>(`/v1/transactions/${payload.symbol}`);
