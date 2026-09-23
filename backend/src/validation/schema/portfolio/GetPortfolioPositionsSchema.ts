import { z } from 'zod';

import { InstrumentLimits, SortOrderTypes } from '@/config/Constants';
import {
  PositionSortFields,
  PositionStatuses
} from '@/domain/PortfolioValuation';

import { boundedTextSchema } from '../BoundedTextSchema';
import { InstrumentAttributesSchema } from '../instrument/InstrumentAttributesSchema';
import { PageQuerySchema } from '../PaginationQuerySchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';

const POSITION_SORT_FIELDS = Object.values(PositionSortFields);
const SORT_ORDERS = Object.values(SortOrderTypes);
const POSITION_STATUSES = Object.values(PositionStatuses);

export const GetPortfolioPositionsSchema = z.object({
  ...PortfolioScopeSchema.shape,
  ...PageQuerySchema.shape,
  sortBy: z
    .enum(
      POSITION_SORT_FIELDS,
      `Sort field must be one of ${POSITION_SORT_FIELDS.join(', ')}`
    )
    .default(PositionSortFields.SYMBOL),
  sortOrder: z
    .enum(SORT_ORDERS, `Sort order must be one of ${SORT_ORDERS.join(', ')}`)
    .default(SortOrderTypes.ASCENDENT),
  search: boundedTextSchema(
    'Search',
    InstrumentLimits.NAME_MAX_LENGTH
  ).optional(),
  type: InstrumentAttributesSchema.shape.type.optional(),
  status: z
    .enum(
      POSITION_STATUSES,
      `Status must be one of ${POSITION_STATUSES.join(', ')}`
    )
    .optional()
});
