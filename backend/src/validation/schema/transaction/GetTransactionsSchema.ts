import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { PageQuerySchema } from '../PaginationQuerySchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import {
  ExecutionTimeSchema,
  TransactionBrokerSchema
} from './TransactionEntrySchema';
import { TransactionTypeSchema } from './TransactionTypeSchema';

export const GetTransactionsQuerySchema = z.object({
  ...PortfolioScopeSchema.shape,
  ...PageQuerySchema.shape,
  symbol: AssetSymbolSchema.optional(),
  type: TransactionTypeSchema.optional(),
  broker: TransactionBrokerSchema.optional(),
  dateFrom: ExecutionTimeSchema.optional(),
  dateTo: ExecutionTimeSchema.optional()
});
