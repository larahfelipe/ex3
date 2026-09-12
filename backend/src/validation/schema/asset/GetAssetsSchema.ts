import { z } from 'zod';

import { SortOrderTypes } from '@/config';

import { PaginationQuerySchema } from '../PaginationQuerySchema';

export const GetAssetsSchema = z.object({
  ...PaginationQuerySchema.shape,
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
