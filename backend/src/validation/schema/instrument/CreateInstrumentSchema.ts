import { z } from 'zod';

import { NewAssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { InstrumentAttributesSchema } from './InstrumentAttributesSchema';

export const CreateInstrumentSchema = z.object({
  symbol: NewAssetSymbolSchema,
  ...InstrumentAttributesSchema.shape
});
