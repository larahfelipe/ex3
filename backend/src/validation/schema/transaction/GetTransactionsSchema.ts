import { z } from 'zod';

export const GetTransactionsSchema = z.object({
  assetId: z
    .string()
    .min(1, 'Asset id must have at least 1 character')
    .transform((value) => value.trim())
});
