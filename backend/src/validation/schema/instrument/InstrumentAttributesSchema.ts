import { z } from 'zod';

import { InstrumentTypes, Markets } from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';

/**
 * Bounds the free-text attributes (OWASP API4:2023, unrestricted resource
 * consumption). Assumed, not measured: above the longest name and sector label
 * an exchange listing publishes.
 */
const NAME_MAX_LENGTH = 120;
const SECTOR_MAX_LENGTH = 60;

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export const InstrumentAttributesSchema = z.object({
  name: boundedTextSchema('Instrument name', NAME_MAX_LENGTH),
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
  sector: boundedTextSchema('Instrument sector', SECTOR_MAX_LENGTH).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(COUNTRY_CODE_PATTERN, 'Instrument country must be a two-letter code')
    .optional()
});
