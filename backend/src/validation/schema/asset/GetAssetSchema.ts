import { z } from 'zod';

import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { AssetSymbolSchema } from './AssetSymbolSchema';

export const GetAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbol: AssetSymbolSchema
});
