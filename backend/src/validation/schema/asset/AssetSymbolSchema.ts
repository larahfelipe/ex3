import { z } from 'zod';

import {
  INSTRUMENT_SYMBOL_PATTERN,
  InstrumentLimits
} from '@/config/Constants';

export const AssetSymbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Asset symbol must have at least 1 character')
  .max(
    InstrumentLimits.SYMBOL_MAX_LENGTH,
    `Asset symbol must have at most ${InstrumentLimits.SYMBOL_MAX_LENGTH} characters`
  );

export const NewAssetSymbolSchema = AssetSymbolSchema.regex(
  INSTRUMENT_SYMBOL_PATTERN,
  'Asset symbol must contain only letters and digits'
);
