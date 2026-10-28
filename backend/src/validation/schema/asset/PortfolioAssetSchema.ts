import { z } from 'zod';

import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { AssetSymbolSchema } from './AssetSymbolSchema';

export const PortfolioAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbol: AssetSymbolSchema
});
