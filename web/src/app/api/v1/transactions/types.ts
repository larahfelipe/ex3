import type {
  DecimalString,
  Maybe,
  WithId,
  WithMessage,
  WithTimestamps
} from '@/types';

import type { Asset } from '../assets';

export type TransactionType = 'BUY' | 'SELL';

export type TransactionProperties = {
  type: TransactionType;
  quantity: DecimalString;
  unitPrice: DecimalString;
  fees: DecimalString;
  taxes: DecimalString;
  currency: string;
  executedAt: string;
  broker: Maybe<string>;
  notes: Maybe<string>;
  portfolioId: string;
  instrumentId: string;
};

export interface Transaction
  extends WithId, WithTimestamps, TransactionProperties {}

export type GetTransactionRequestPayload = Pick<Asset, 'symbol'>;

export type GetTransactionCountRequestPayload = Pick<Asset, 'symbol'>;

export type GetTransactionCountResponseData = Record<'buy' | 'sell', number>;

export type CreateTransactionRequestPayload = Pick<
  TransactionProperties,
  'type' | 'currency' | 'executedAt'
> &
  Record<'quantity' | 'unitPrice' | 'assetSymbol' | 'portfolioId', string>;

export interface CreateTransactionResponseData extends WithMessage {
  transaction: Transaction;
}
