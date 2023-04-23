import { z } from 'zod';

export const GetTransactionSchema = z.object({
  id: z
    .string()
    .min(1, 'Transaction id must have at least 1 character')
    .transform((value) => value.trim())
});
