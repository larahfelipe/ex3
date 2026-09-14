import { z } from 'zod';

import { PageQuerySchema } from '../PaginationQuerySchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';

export const GetPortfolioPositionsSchema = z.object({
  ...PortfolioScopeSchema.shape,
  ...PageQuerySchema.shape
});
