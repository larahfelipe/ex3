import { z } from 'zod';

export const DeleteTransactionSchema = z.object({
  id: z
    .string()
    .min(1, 'Transaction id must have at least 3 characters')
    .transform((value) => value.trim())
});
