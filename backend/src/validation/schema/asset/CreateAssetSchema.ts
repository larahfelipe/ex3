import { z } from 'zod';

export const CreateAssetSchema = z.object({
  symbol: z
    .string()
    .min(3, 'Asset symbol must have at least 3 characters')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase())
});
