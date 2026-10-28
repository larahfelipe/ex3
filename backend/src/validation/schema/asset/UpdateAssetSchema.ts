import { z } from 'zod';

import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { AssetSymbolSchema, NewAssetSymbolSchema } from './AssetSymbolSchema';

export const UpdateAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  oldSymbol: AssetSymbolSchema,
  newSymbol: NewAssetSymbolSchema
});
