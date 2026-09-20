import type {
  DecimalString,
  Maybe,
  Page,
  PageParams,
  WithId,
  WithMessage,
  WithTimestamps
} from '@/types';

import type { Asset } from '../assets';
import type { PortfolioScopeParams } from '../portfolio';

export type TransactionType =
  'BUY' | 'SELL' | 'DIVIDEND' | 'JCP' | 'INTEREST' | 'BONUS';

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

export type ListedTransaction = Transaction & Pick<Asset, 'symbol'>;

export type TransactionFilters = PageParams &
  Partial<
    Pick<TransactionProperties, 'type'> &
      Record<'symbol' | 'broker' | 'dateFrom' | 'dateTo', string>
  >;

export type GetTransactionsRequestParams = PortfolioScopeParams &
  TransactionFilters;

export type GetTransactionsResponseData = Page<ListedTransaction>;

export type TransactionEntryPayload = Pick<
  TransactionProperties,
  'type' | 'currency' | 'executedAt' | 'broker' | 'notes'
> &
  Record<'quantity' | 'unitPrice' | 'fees' | 'taxes', string>;

export type CreateTransactionRequestPayload = TransactionEntryPayload &
  Record<'assetSymbol' | 'portfolioId', string>;

export interface CreateTransactionResponseData extends WithMessage {
  transaction: Transaction;
}

export type UpdateTransactionRequestPayload = TransactionEntryPayload;

export type UpdateTransactionResponseData = WithMessage;

export type DeleteTransactionResponseData = WithMessage;
