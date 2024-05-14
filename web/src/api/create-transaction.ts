import { api } from '@/lib/axios';
import type { WithMessage } from '@/types';

import type { Transaction, TransactionProperties } from './get-transactions';

export type CreateTransactionPayload = Omit<
  TransactionProperties,
  'assetId' | 'createdAt' | 'updatedAt'
> &
  Record<'assetSymbol', string>;

export interface CreateTransactionResponse extends WithMessage {
  transaction: Transaction;
}

export const createTransaction = async (payload: CreateTransactionPayload) =>
  await api.post<CreateTransactionResponse>('/v1/transaction', payload);
