import { z } from 'zod';

import { AssetSymbolSchema } from './AssetSymbolSchema';

export const GetAssetSchema = z.object({
  symbol: AssetSymbolSchema
});
