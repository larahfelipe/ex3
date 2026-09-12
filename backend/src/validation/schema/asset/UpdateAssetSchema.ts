import { z } from 'zod';

import { AssetSymbolSchema, NewAssetSymbolSchema } from './AssetSymbolSchema';

export const UpdateAssetSchema = z.object({
  oldSymbol: AssetSymbolSchema,
  newSymbol: NewAssetSymbolSchema
});
