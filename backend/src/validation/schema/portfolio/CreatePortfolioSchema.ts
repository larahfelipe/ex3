import { z } from 'zod';

import { normalizePortfolioName } from '@/domain/PortfolioName';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';

/**
 * Bounds the portfolio name (OWASP API4:2023, unrestricted resource
 * consumption). Assumed, not measured: above any label a user gives a
 * portfolio.
 */
const NAME_MAX_LENGTH = 60;

export const CreatePortfolioSchema = z.object({
  name: z
    .string()
    .transform(normalizePortfolioName)
    .pipe(boundedTextSchema('Portfolio name', NAME_MAX_LENGTH)),
  baseCurrency: currencyCodeSchema('Portfolio base currency')
});
