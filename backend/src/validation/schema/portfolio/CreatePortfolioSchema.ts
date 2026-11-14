import { z } from 'zod';

import { normalizePortfolioName } from '@/domain/PortfolioName';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';

const NAME_MAX_LENGTH = 60;

export const CreatePortfolioSchema = z.object({
  name: z
    .string()
    .transform(normalizePortfolioName)
    .pipe(boundedTextSchema('Portfolio name', NAME_MAX_LENGTH)),
  baseCurrency: currencyCodeSchema('Portfolio base currency')
});
