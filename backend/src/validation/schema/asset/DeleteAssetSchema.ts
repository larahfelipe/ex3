import { z } from 'zod';

import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { AssetSymbolSchema } from './AssetSymbolSchema';

export const DeleteAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbol: AssetSymbolSchema
});
