import { z } from 'zod';

export const GetTransactionsQuerySchema = z.object({
  page: z.coerce.number().positive('Page must be greater than zero').optional(),
  limit: z.coerce
    .number()
    .positive('Limit must be greater than zero')
    .optional()
});

export const GetTransactionsParamsSchema = z.object({
  assetSymbol: z
    .string()
    .min(1, 'Asset symbol must have at least 1 character')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase())
});
