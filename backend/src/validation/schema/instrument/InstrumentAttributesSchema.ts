import { z } from 'zod';

import { InstrumentLimits, InstrumentTypes, Markets } from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export const InstrumentAttributesSchema = z.object({
  name: boundedTextSchema('Instrument name', InstrumentLimits.NAME_MAX_LENGTH),
  type: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z.enum(
        InstrumentTypes,
        `Instrument type must be one of ${Object.keys(InstrumentTypes).join(', ')}`
      )
    ),
  market: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z.enum(
        Markets,
        `Instrument market must be one of ${Object.keys(Markets).join(', ')}`
      )
    ),
  currency: currencyCodeSchema('Instrument currency'),
  sector: boundedTextSchema(
    'Instrument sector',
    InstrumentLimits.SECTOR_MAX_LENGTH
  ).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(COUNTRY_CODE_PATTERN, 'Instrument country must be a two-letter code')
    .optional()
});
