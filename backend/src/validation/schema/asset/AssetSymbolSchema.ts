import { z } from 'zod';

import {
  INSTRUMENT_SYMBOL_PATTERN,
  InstrumentLimits
} from '@/config/Constants';

/**
 * Normalised before it is bounded, so a blank value is rejected instead of
 * becoming the empty symbol. Used to address a symbol that is already stored.
 */
export const AssetSymbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Asset symbol must have at least 1 character')
  .max(
    InstrumentLimits.SYMBOL_MAX_LENGTH,
    `Asset symbol must have at most ${InstrumentLimits.SYMBOL_MAX_LENGTH} characters`
  );

/**
 * Only a symbol about to be stored is held to the allowlist, so an asset stored
 * before it existed can still be read, renamed and deleted.
 */
export const NewAssetSymbolSchema = AssetSymbolSchema.regex(
  INSTRUMENT_SYMBOL_PATTERN,
  'Asset symbol must contain only letters and digits'
);
