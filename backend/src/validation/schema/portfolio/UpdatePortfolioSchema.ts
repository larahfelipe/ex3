import { z } from 'zod';

import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { CreatePortfolioSchema } from './CreatePortfolioSchema';

export const UpdatePortfolioSchema = z
  .object({
    ...PortfolioScopeSchema.shape,
    ...CreatePortfolioSchema.partial().shape
  })
  .refine(
    ({ name, baseCurrency }) =>
      name !== undefined || baseCurrency !== undefined,
    'At least one portfolio attribute must be provided'
  );
