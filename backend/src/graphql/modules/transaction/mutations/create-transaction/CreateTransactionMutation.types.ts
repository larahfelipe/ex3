import type { Transaction, TransactionType } from '@/domain/models';

export type CreateTransactionResponse = {
  transaction: Transaction | null;
  message: string | null;
};

export type InputPayload = {
  type: TransactionType;
  amount: number;
  price: number;
  assetId: string;
};
