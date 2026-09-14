import { z } from 'zod';

import { MAX_PAGE_LIMIT } from '../PaginationQuerySchema';
import { PortfolioScopeSchema } from '../PortfolioScopeSchema';
import { AssetSymbolSchema } from './AssetSymbolSchema';

const SYMBOL_SEPARATOR = ',';

/** One request values at most the assets of the largest page. */
export const GetAssetValuationsSchema = z.object({
  ...PortfolioScopeSchema.shape,
  symbols: z
    .string('Symbols must be a comma-separated list of asset symbols')
    .transform((symbols) => symbols.split(SYMBOL_SEPARATOR))
    .pipe(
      z
        .array(AssetSymbolSchema)
        .max(
          MAX_PAGE_LIMIT,
          `At most ${MAX_PAGE_LIMIT} symbols can be valued at once`
        )
    )
    .transform((symbols) => [...new Set(symbols)])
});
