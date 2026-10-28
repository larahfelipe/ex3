import { z } from 'zod';

import { InstrumentLimits } from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { PaginationQuerySchema } from '../PaginationQuerySchema';

const CATALOG_SEARCH_PATTERN = /^[\p{L}\p{N} .&'-]+$/u;

/** Letters, digits and name punctuation only, so no `ILIKE` wildcard reaches the query. */
export const InstrumentSearchTermSchema = boundedTextSchema(
  'Search',
  InstrumentLimits.NAME_MAX_LENGTH
).regex(
  CATALOG_SEARCH_PATTERN,
  "Search accepts only letters, digits, spaces and . & ' -"
);

export const GetAllInstrumentsSchema = z.object({
  ...PaginationQuerySchema.shape,
  search: InstrumentSearchTermSchema.optional()
});
