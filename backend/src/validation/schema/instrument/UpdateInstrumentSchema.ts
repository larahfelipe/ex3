import { z } from 'zod';

import { AssetSymbolSchema } from '../asset/AssetSymbolSchema';
import { InstrumentAttributesSchema } from './InstrumentAttributesSchema';

/**
 * The symbol is the instrument's identity, shared by every position holding it,
 * so it addresses the instrument and is never among the attributes replaced.
 */
export const UpdateInstrumentSchema = z.object({
  symbol: AssetSymbolSchema,
  attributes: InstrumentAttributesSchema.partial().refine(
    (attributes) =>
      Object.values(attributes).some((value) => value !== undefined),
    'At least one instrument attribute must be provided'
  )
});
