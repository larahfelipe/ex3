import { z } from 'zod';

import { SortTypes } from '@/config';

export const GetAssetsSchema = z.object({
  sort: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine(
      (value) =>
        Object.values(SortTypes).includes(
          value as (typeof SortTypes)[keyof typeof SortTypes]
        ),
      {
        message: 'Sort type must be either `asc` or `desc`'
      }
    )
    .optional()
});
