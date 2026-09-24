import { z } from 'zod';

import { Pagination } from '@/config/Constants';

const PageNumberSchema = z.coerce
  .number()
  .int('Page must be an integer')
  .positive('Page must be greater than zero')
  .default(Pagination.FIRST_PAGE);

export const PaginationQuerySchema = z.object({
  page: PageNumberSchema,
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be greater than zero')
    .max(Pagination.MAX_SIZE, `Limit must be at most ${Pagination.MAX_SIZE}`)
    .default(Pagination.DEFAULT_SIZE)
});

export const PageQuerySchema = z.object({
  page: PageNumberSchema,
  pageSize: z.coerce
    .number()
    .int('Page size must be an integer')
    .positive('Page size must be greater than zero')
    .max(
      Pagination.MAX_SIZE,
      `Page size must be at most ${Pagination.MAX_SIZE}`
    )
    .default(Pagination.DEFAULT_SIZE)
});
