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

export type ListedTransaction = Transaction & Pick<Asset, 'symbol'>;

export type TransactionFilters = PageParams &
  Partial<
    Pick<TransactionProperties, 'type'> &
      Record<'symbol' | 'broker' | 'dateFrom' | 'dateTo', string>
  >;

export type GetTransactionsRequestParams = PortfolioScopeParams &
  TransactionFilters;

export type GetTransactionsResponseData = Page<ListedTransaction>;

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
