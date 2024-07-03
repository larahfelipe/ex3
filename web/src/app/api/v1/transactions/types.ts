import type { Pagination, WithId, WithMessage, WithTimestamps } from '@/types';

import type { Asset } from '../assets';

export type TransactionType = 'BUY' | 'SELL';

export type TransactionProperties = {
  type: TransactionType;
  amount: number;
  price: number;
  assetId: string;
};

export interface Transaction
  extends WithId,
    WithTimestamps,
    TransactionProperties {}

export type GetTransactionRequestPayload = Pick<Asset, 'symbol'>;

export type GetTransactionsResponseData = {
  transactions: Array<Transaction>;
  pagination: Pagination;
};

export type GetTransactionCountRequestPayload = Pick<Asset, 'symbol'>;

export type GetTransactionCountResponseData = Record<'buy' | 'sell', number>;

export type CreateTransactionRequestPayload = Omit<
  TransactionProperties,
  'assetId' & WithTimestamps
> &
  Record<'assetSymbol', string>;

export interface CreateTransactionResponseData extends WithMessage {
  transaction: Transaction;
}
