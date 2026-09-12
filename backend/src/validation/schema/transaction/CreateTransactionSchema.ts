import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { TransactionTypeSchema } from './TransactionTypeSchema';

export const CreateTransactionSchema = z.object({
  ...PortfolioScopeSchema.shape,
  type: TransactionTypeSchema,
  amount: z.number().positive('Transaction amount must be greater than zero'),
  price: z.number().positive('Transaction price must be greater than zero'),
  assetSymbol: AssetSymbolSchema
});
