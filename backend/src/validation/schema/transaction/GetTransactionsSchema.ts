import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { PaginationQuerySchema } from '../PaginationQuerySchema';

export const GetTransactionsQuerySchema = z.object({
  ...PaginationQuerySchema.shape,
  lastId: z
    .string()
    .transform((value) => value.trim())
    .optional()
});

export const GetTransactionsParamsSchema = z.object({
  assetSymbol: AssetSymbolSchema
});
