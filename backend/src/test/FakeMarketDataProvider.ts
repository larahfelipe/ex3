import type {
  Listing,
  ListingLookup,
  ListingSearch,
  MarketDataProvider,
  PriceHistoryLookup,
  PricedInstrument,
  PriceInterval,
  PriceRange,
  Quote,
  QuoteLookup
} from '@/domain/MarketDataProvider';

type SeededPrice = Omit<Quote, 'source'>;

type SeededListing = Listing & Partial<Record<'sector', string>>;

export const FAKE_MARKET_DATA_SOURCE = 'fake';

/**
 * An exchange rate is seeded under the codes of its pair, as `USDBRL` for one
 * dollar in reais. A listing is seeded apart from prices, since a search
 * answers what the provider lists and not what it quotes.
 */
export class FakeMarketDataProvider implements MarketDataProvider {
  private readonly pricesBySymbol: ReadonlyMap<string, Quote[]>;
  private readonly listings: ReadonlyArray<SeededListing>;
  private readonly isAvailable: boolean;

  constructor(
    seededPrices: Record<string, [SeededPrice, ...SeededPrice[]]>,
    {
      isAvailable = true,
      listings = []
    }: Partial<
      Record<'isAvailable', boolean> &
        Record<'listings', ReadonlyArray<SeededListing>>
    > = {}
  ) {
    this.pricesBySymbol = new Map<string, Quote[]>(
      Object.entries(seededPrices).map(([symbol, prices]) => [
        symbol,
        prices
          .map((price) => ({ ...price, source: FAKE_MARKET_DATA_SOURCE }))
          .toSorted((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      ])
    );
    this.listings = listings;
    this.isAvailable = isAvailable;
  }

  async findListings(symbol: string): Promise<ListingSearch> {
    if (!this.isAvailable) return { outcome: 'unavailable' };

    return {
      outcome: 'searched',
      listings: this.listings
        .filter((listing) => listing.symbol === symbol)
        .map(({ sector: _sector, ...listing }) => listing)
    };
  }

  async describeListing({
    symbol,
    market,
    currency
  }: PricedInstrument): Promise<ListingLookup> {
    if (!this.isAvailable) return { outcome: 'unavailable' };

    const listing = this.listings.find(
      (seeded) =>
        seeded.symbol === symbol &&
        seeded.market === market &&
        seeded.currency === currency
    );

    return listing
      ? {
          outcome: 'listed',
          listing: { ...listing, sector: listing.sector ?? null }
        }
      : { outcome: 'not-found' };
  }

  async getQuotes(
    instruments: ReadonlyArray<PricedInstrument>
  ): Promise<ReadonlyMap<string, QuoteLookup>> {
    return new Map(
      instruments.map(({ symbol }) => [symbol, this.quote(symbol)])
    );
  }

  async getExchangeRates(
    currencies: ReadonlyArray<string>,
    baseCurrency: string
  ): Promise<ReadonlyMap<string, QuoteLookup>> {
    return new Map(
      currencies.map((currency) => [
        currency,
        this.quote(`${currency}${baseCurrency}`)
      ])
    );
  }

  async getHistoricalPrices(
    { symbol }: PricedInstrument,
    range: PriceRange,
    _interval: PriceInterval
  ): Promise<PriceHistoryLookup> {
    return this.history(symbol, range);
  }

  async getHistoricalExchangeRate(
    currency: string,
    baseCurrency: string,
    range: PriceRange
  ): Promise<PriceHistoryLookup> {
    return this.history(`${currency}${baseCurrency}`, range);
  }

  private history(
    symbol: string,
    { from, to }: PriceRange
  ): PriceHistoryLookup {
    if (!this.isAvailable) return { outcome: 'unavailable' };

    const prices = this.pricesBySymbol.get(symbol);

    if (!prices) return { outcome: 'not-found' };

    return {
      outcome: 'quoted',
      prices: prices.filter(
        ({ timestamp }) =>
          timestamp.getTime() >= from.getTime() &&
          timestamp.getTime() < to.getTime()
      )
    };
  }

  private quote(symbol: string): QuoteLookup {
    if (!this.isAvailable) return { outcome: 'unavailable' };

    const latest = this.pricesBySymbol.get(symbol)?.at(-1);

    return latest
      ? { outcome: 'quoted', quote: latest }
      : { outcome: 'not-found' };
  }
}
