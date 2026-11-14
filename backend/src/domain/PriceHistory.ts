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
