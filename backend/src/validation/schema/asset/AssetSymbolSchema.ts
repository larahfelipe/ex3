import { z } from 'zod';

const SYMBOL_MAX_LENGTH = 6;

/** Letters and digits only: the same set the web form lets a user type. */
const NEW_SYMBOL_PATTERN = /^[A-Z0-9]+$/;

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
    SYMBOL_MAX_LENGTH,
    `Asset symbol must have at most ${SYMBOL_MAX_LENGTH} characters`
  );

/**
 * Only a symbol about to be stored is held to the allowlist, so an asset stored
 * before it existed can still be read, renamed and deleted.
 */
export const NewAssetSymbolSchema = AssetSymbolSchema.regex(
  NEW_SYMBOL_PATTERN,
  'Asset symbol must contain only letters and digits'
);
