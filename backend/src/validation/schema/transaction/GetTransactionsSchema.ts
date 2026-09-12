import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { PaginationQuerySchema } from '../PaginationQuerySchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';

export const GetTransactionsQuerySchema = z.object({
  ...PortfolioScopeSchema.shape,
  ...PaginationQuerySchema.shape,
  lastId: z
    .string()
    .transform((value) => value.trim())
    .optional()
});

export const GetTransactionsParamsSchema = z.object({
  assetSymbol: AssetSymbolSchema
});
