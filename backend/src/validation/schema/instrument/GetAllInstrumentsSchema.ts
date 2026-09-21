import { z } from 'zod';

import { boundedTextSchema } from '../BoundedTextSchema';
import { PaginationQuerySchema } from '../PaginationQuerySchema';
import { INSTRUMENT_NAME_MAX_LENGTH } from './InstrumentAttributesSchema';

const CATALOG_SEARCH_PATTERN = /^[\p{L}\p{N} .&'-]+$/u;

export const GetAllInstrumentsSchema = z.object({
  ...PaginationQuerySchema.shape,
  search: boundedTextSchema('Search', INSTRUMENT_NAME_MAX_LENGTH)
    .regex(
      CATALOG_SEARCH_PATTERN,
      "Search accepts only letters, digits, spaces and . & ' -"
    )
    .optional()
});
