import { z } from 'zod';

export const CreateAssetSchema = z.object({
  symbol: z
    .string()
    .min(1, 'Asset symbol must have at least 1 character')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase())
});
