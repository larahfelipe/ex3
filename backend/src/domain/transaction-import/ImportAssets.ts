import { Markets } from '@/config/Constants';
import type { Listing } from '@/domain/MarketDataProvider';

import type { AssetResolution } from './ImportPlan';
import type { ReadRow } from './ImportReading';

/** An instrument the portfolio holds or the person sees, by its symbol. */
export type KnownInstrument = Record<'instrumentId' | 'name', string> &
  Record<'currency', string | null>;

/**
 * What the quote provider answered for a symbol no known instrument has: the
 * listing a row's currency picks, none, more than one for a row without a
 * currency, no answer, or no question, past the new assets an import looks up.
 */
export type ListingResolution =
  | (Record<'outcome', 'listed'> &
      Record<'listing', Listing & Partial<Record<'sector', string | null>>>)
  | Record<'outcome', 'not-listed' | 'ambiguous' | 'unavailable' | 'skipped'>;

export type ImportAssetState = Record<
  'held' | 'tracked',
  ReadonlyMap<string, KnownInstrument>
> &
  Record<'listings', ReadonlyMap<string, ListingResolution>>;

const UNRESOLVED_REASONS = {
  'not-listed': 'not-listed',
  ambiguous: 'currency-unknown',
  unavailable: 'market-data-unavailable',
  skipped: 'too-many-new-assets'
} as const;

/** The currency the rows of each symbol name first, null when none does. */
export const importCurrenciesOf = (rows: ReadonlyArray<ReadRow>) => {
  const currencies = new Map<string, string | null>();

  for (const { mapped } of rows) {
    if (mapped.outcome !== 'entry') continue;

    const { symbol, currency } = mapped.entry;

    if (currencies.get(symbol) == null) currencies.set(symbol, currency);
  }

  return currencies;
};

/**
 * The listing of a symbol a row's currency picks. Without a currency, B3's
 * listing, where a ticker of a statement trades, or the only one there is.
 */
export const pickListing = (
  listings: ReadonlyArray<Listing>,
  currency: string | null
): ListingResolution => {
  const candidates =
    currency === null
      ? listings
      : listings.filter((listing) => listing.currency === currency);
  const listing =
    candidates.find(({ market }) => market === Markets.B3) ??
    (candidates.length === 1 ? candidates[0] : undefined);

  if (listing !== undefined) return { outcome: 'listed', listing };

  return candidates.length === 0
    ? { outcome: 'not-listed' }
    : { outcome: 'ambiguous' };
};

/** Each symbol on what it is recorded: held first, then seen, then listed. */
export const resolveImportAssets = (
  symbols: Iterable<string>,
  { held, tracked, listings }: ImportAssetState
) =>
  new Map<string, AssetResolution>(
    [...symbols].map((symbol): [string, AssetResolution] => {
      const heldInstrument = held.get(symbol);

      if (heldInstrument !== undefined)
        return [symbol, { status: 'held', ...heldInstrument }];

      const trackedInstrument = tracked.get(symbol);

      if (trackedInstrument !== undefined)
        return [symbol, { status: 'tracked', ...trackedInstrument }];

      const lookup = listings.get(symbol);

      if (lookup === undefined)
        return [symbol, { status: 'unresolved', reason: 'not-found' }];

      if (lookup.outcome === 'listed')
        return [
          symbol,
          {
            status: 'listed',
            name: lookup.listing.name,
            currency: lookup.listing.currency
          }
        ];

      return [
        symbol,
        { status: 'unresolved', reason: UNRESOLVED_REASONS[lookup.outcome] }
      ];
    })
  );
