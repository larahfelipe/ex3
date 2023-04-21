type TransactionType = 'BUY' | 'SELL';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
};
