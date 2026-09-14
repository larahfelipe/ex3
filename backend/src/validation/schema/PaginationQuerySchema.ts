import { z } from 'zod';

/**
 * Bounds the rows one response can carry (OWASP API4:2023, unrestricted
 * resource consumption). Above every page size the web offers.
 */
export const MAX_PAGE_LIMIT = 100;

/** The page size the listings before the page query default to. */
const DEFAULT_PAGE_SIZE = 10;

const FIRST_PAGE = 1;

const PageNumberSchema = z.coerce
  .number()
  .int('Page must be an integer')
  .positive('Page must be greater than zero');

export const PaginationQuerySchema = z.object({
  page: PageNumberSchema.optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be greater than zero')
    .max(MAX_PAGE_LIMIT, `Limit must be at most ${MAX_PAGE_LIMIT}`)
    .optional()
});

export const PageQuerySchema = z.object({
  page: PageNumberSchema.default(FIRST_PAGE),
  pageSize: z.coerce
    .number()
    .int('Page size must be an integer')
    .positive('Page size must be greater than zero')
    .max(MAX_PAGE_LIMIT, `Page size must be at most ${MAX_PAGE_LIMIT}`)
    .default(DEFAULT_PAGE_SIZE)
});
