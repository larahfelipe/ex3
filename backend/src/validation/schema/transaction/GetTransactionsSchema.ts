import { z } from 'zod';

export const GetTransactionsSchema = z.object({
  assetId: z
    .string()
    .transform((value) => value.trim())
    .optional()
});
