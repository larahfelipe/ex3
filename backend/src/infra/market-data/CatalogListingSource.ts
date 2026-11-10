import type {
  ListingCatalog,
  ListingLookup,
  ListingSearch,
  ListingSource,
  PricedInstrument
} from '@/domain/MarketDataProvider';

import { BrapiTickerCatalog } from './BrapiTickerCatalog';
import { YahooFinanceProvider } from './YahooFinanceProvider';

/**
 * `ListingSource` that answers from the catalog every symbol it holds, asked
 * for in the catalog's currency or in none, and asks the provider about the
 * rest in one search. While the catalog is unavailable every symbol is asked
 * of the provider, as if there were no catalog.
 */
export class CatalogListingSource implements ListingSource {
  private static INSTANCE: CatalogListingSource;
  private readonly catalog: ListingCatalog;
  private readonly provider: ListingSource;

  constructor(catalog: ListingCatalog, provider: ListingSource) {
    this.catalog = catalog;
    this.provider = provider;
  }

  static getInstance() {
    if (!CatalogListingSource.INSTANCE)
      CatalogListingSource.INSTANCE = new CatalogListingSource(
        BrapiTickerCatalog.getInstance(),
        YahooFinanceProvider.getInstance()
      );

    return CatalogListingSource.INSTANCE;
  }

  async findListings(
    currencyBySymbol: ReadonlyMap<string, string | null>
  ): Promise<ReadonlyMap<string, ListingSearch>> {
    const catalog = await this.catalog.getListings();
    const held = new Map<string, ListingSearch>();
    const asked = new Map<string, string | null>();

    for (const [symbol, currency] of currencyBySymbol) {
      const listing =
        catalog.outcome === 'listed' ? catalog.listings.get(symbol) : undefined;

      if (
        listing !== undefined &&
        (currency === null || currency === listing.currency)
      ) {
        const { sector: _sector, ...listed } = listing;

        held.set(symbol, { outcome: 'searched', listings: [listed] });
      } else asked.set(symbol, currency);
    }

    if (asked.size === 0) return held;

    return new Map([...held, ...(await this.provider.findListings(asked))]);
  }

  async describeListing(instrument: PricedInstrument): Promise<ListingLookup> {
    const catalog = await this.catalog.getListings();
    const listing =
      catalog.outcome === 'listed'
        ? catalog.listings.get(instrument.symbol)
        : undefined;

    return listing !== undefined &&
      listing.market === instrument.market &&
      listing.currency === instrument.currency
      ? { outcome: 'listed', listing }
      : this.provider.describeListing(instrument);
  }
}
