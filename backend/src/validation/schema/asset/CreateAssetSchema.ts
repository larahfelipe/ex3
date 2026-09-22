import { z } from 'zod';

import { InstrumentAttributesSchema } from '../instrument/InstrumentAttributesSchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { NewAssetSymbolSchema } from './AssetSymbolSchema';

export const CreateAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbol: NewAssetSymbolSchema,
  instrument: InstrumentAttributesSchema.optional()
});
