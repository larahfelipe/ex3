import { z } from 'zod';

export const UpdateAssetSchema = z.object({
  oldSymbol: z
    .string()
    .min(1, 'Asset symbol must have at least 1 character')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase()),
  newSymbol: z
    .string()
    .min(1, 'Asset symbol must have at least 1 character')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase())
});
