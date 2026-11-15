import { z } from 'zod';

import { InstrumentLimits } from '@/config/Constants';

const MILLISECONDS_PER_SECOND = 1_000;

const RETRY_AFTER_BOUNDS_MS = { min: 1_000, max: 3_600_000 } as const;

export const ListingNameSchema = z
  .string()
  .trim()
  .min(1)
  .optional()
  .catch(undefined);

export const SectorSchema = z
  .string()
  .trim()
  .min(1)
  .max(InstrumentLimits.SECTOR_MAX_LENGTH);

/** Bounded by code points, so a surrogate pair is never split. */
export const toListingName = (name: string) =>
  [...name.replace(/\s+/g, ' ')]
    .slice(0, InstrumentLimits.NAME_MAX_LENGTH)
    .join('')
    .trimEnd();

export const retryAfterMsOf = (header: string | null, now: number) => {
  const value = header?.trim() ?? '';
  const delayMs = /^\d+$/.test(value)
    ? Number(value) * MILLISECONDS_PER_SECOND
    : Date.parse(value) - now;

  return Number.isNaN(delayMs)
    ? null
    : Math.min(
        Math.max(delayMs, RETRY_AFTER_BOUNDS_MS.min),
        RETRY_AFTER_BOUNDS_MS.max
      );
};
