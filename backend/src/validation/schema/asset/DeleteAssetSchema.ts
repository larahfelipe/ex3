import { z } from 'zod';

import { AssetSymbolSchema } from './AssetSymbolSchema';

export const DeleteAssetSchema = z.object({
  symbol: AssetSymbolSchema
});
