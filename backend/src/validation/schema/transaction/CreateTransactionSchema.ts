import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { TransactionEntrySchema } from './TransactionEntrySchema';

export const CreateTransactionSchema = z.object({
  ...PortfolioScopeSchema.shape,
  ...TransactionEntrySchema.shape,
  assetSymbol: AssetSymbolSchema
});
