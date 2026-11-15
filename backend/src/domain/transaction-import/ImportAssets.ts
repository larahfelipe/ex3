import { Markets } from '@/config/Constants';
import type { Listing } from '@/domain/MarketDataProvider';

import type { AssetResolution } from './ImportPlan';
import type { ReadRow } from './ImportReading';

export type KnownInstrument = Record<'instrumentId' | 'name', string> &
  Record<'currency', string | null>;

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

export const importCurrenciesOf = (rows: ReadonlyArray<ReadRow>) => {
  const currencies = new Map<string, string | null>();

  for (const { mapped } of rows) {
    if (mapped.outcome !== 'entry') continue;

    const { symbol, currency } = mapped.entry;

    if (currencies.get(symbol) == null) currencies.set(symbol, currency);
  }

  return currencies;
};

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
