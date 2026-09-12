import { z } from 'zod';

/**
 * Bounds the rows one response can carry (OWASP API4:2023, unrestricted
 * resource consumption). Above every page size the web offers.
 */
const MAX_PAGE_LIMIT = 100;

export const PaginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .positive('Page must be greater than zero')
    .optional(),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be greater than zero')
    .max(MAX_PAGE_LIMIT, `Limit must be at most ${MAX_PAGE_LIMIT}`)
    .optional()
});
