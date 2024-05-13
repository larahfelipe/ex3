import { z } from 'zod';

export const GetTransactionsQuerySchema = z.object({
  page: z.coerce.number().positive('Page must be greater than zero').optional(),
  limit: z.coerce
    .number()
    .positive('Limit must be greater than zero')
    .optional()
});

export const GetTransactionsParamsSchema = z.object({
  assetId: z.string().transform((value) => value.trim())
});
