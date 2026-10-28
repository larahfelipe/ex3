export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'JCP'
  | 'INTEREST'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SPLIT'
  | 'BONUS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT';

/** Quantities and monetary values are decimal strings, exact to the scale of their columns. */
export type Transaction = {
  id: string;
  type: TransactionType;
  quantity: string;
  unitPrice: string;
  fees: string;
  taxes: string;
  currency: string;
  executedAt: Date;
  broker: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  portfolioId: string;
  instrumentId: string;
};

export type TransactionEntry = Pick<
  Transaction,
  | 'type'
  | 'quantity'
  | 'unitPrice'
  | 'fees'
  | 'taxes'
  | 'currency'
  | 'executedAt'
  | 'broker'
  | 'notes'
>;
