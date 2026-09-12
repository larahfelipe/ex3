import { z } from 'zod';

import { NewAssetSymbolSchema } from './AssetSymbolSchema';

export const CreateAssetSchema = z.object({
  symbol: NewAssetSymbolSchema
});
