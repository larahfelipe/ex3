import { z } from 'zod';

import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { NewAssetSymbolSchema } from './AssetSymbolSchema';

export const CreateAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbol: NewAssetSymbolSchema
});
