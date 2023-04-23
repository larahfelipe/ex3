import type { Transaction, TransactionType } from '@/domain/models';

export type UpdateTransactionResponse = {
  transaction: Transaction | null;
  message: string | null;
};

export type InputPayload = {
  id: string;
  type: TransactionType;
  amount: number;
  price: number;
};
