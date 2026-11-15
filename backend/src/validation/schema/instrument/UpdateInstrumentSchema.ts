import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { InstrumentAttributesSchema } from './InstrumentAttributesSchema';

export const UpdateInstrumentSchema = z.object({
  symbol: AssetSymbolSchema,
  attributes: InstrumentAttributesSchema.partial().refine(
    (attributes) =>
      Object.values(attributes).some((value) => value !== undefined),
    'At least one instrument attribute must be provided'
  )
});
