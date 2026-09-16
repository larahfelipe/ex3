import type { PriceRange } from './MarketDataProvider';

type StoredClose = Record<'timestamp', Date>;

type ClosedExtremes = Record<'oldest' | 'newest', Date>;

export const startOfDayInUtc = (instant: Date) =>
  new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate()
    )
  );

const dayAfter = (day: Date) =>
  new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)
  );

const extremesOf = (stored: ReadonlyArray<StoredClose>) =>
  stored.reduce<ClosedExtremes | null>(
    (extremes, { timestamp }) =>
      extremes === null
        ? { oldest: timestamp, newest: timestamp }
        : {
            oldest: timestamp < extremes.oldest ? timestamp : extremes.oldest,
            newest: timestamp > extremes.newest ? timestamp : extremes.newest
          },
    null
  );

/**
 * What to ask the provider for so a series already stored is not fetched again:
 * the part of the range before the oldest close stored and the part after the
 * newest, in ascending order. The current day in UTC is never asked, because it
 * has no close yet and asking would spend a provider request on every read. A
 * day between the extremes is never asked again either: a day without a close
 * is a day the market did not trade.
 */
export const missingRangesOf = (
  stored: ReadonlyArray<StoredClose>,
  { from, to }: PriceRange,
  now: Date
): ReadonlyArray<PriceRange> => {
  const today = startOfDayInUtc(now);
  const coverableTo = today < to ? today : to;

  if (from >= coverableTo) return [];

  const extremes = extremesOf(stored);

  if (extremes === null) return [{ from, to: coverableTo }];

  const afterNewest = dayAfter(extremes.newest);

  return [
    ...(from < extremes.oldest ? [{ from, to: extremes.oldest }] : []),
    ...(afterNewest < coverableTo
      ? [{ from: afterNewest, to: coverableTo }]
      : [])
  ];
};
