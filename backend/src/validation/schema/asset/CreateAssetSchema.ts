import { z } from 'zod';

import { InstrumentAttributesSchema } from '../instrument/InstrumentAttributesSchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { NewAssetSymbolSchema } from './AssetSymbolSchema';

/**
 * With `listing`, the symbol is registered from what the quote provider lists
 * in that market and currency, so no attribute of the instrument is taken from
 * the client.
 */
export const CreateAssetSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbol: NewAssetSymbolSchema,
  listing: InstrumentAttributesSchema.pick({
    market: true,
    currency: true
  }).optional()
});
