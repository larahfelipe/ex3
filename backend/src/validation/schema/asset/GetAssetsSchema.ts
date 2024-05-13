import { z } from 'zod';

import { SortOrderTypes } from '@/config';

export const GetAssetsSchema = z.object({
  page: z.coerce.number().positive('Page must be greater than zero').optional(),
  limit: z.coerce
    .number()
    .positive('Limit must be greater than zero')
    .optional(),
  sort: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine(
      (value) =>
        Object.values(SortOrderTypes).includes(
          value as (typeof SortOrderTypes)[keyof typeof SortOrderTypes]
        ),
      {
        message: 'Sort order must be either `asc` or `desc`'
      }
    )
    .optional()
});
