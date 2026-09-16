import type {
  MarketDataProvider,
  PriceHistoryLookup,
  PricedInstrument,
  PriceInterval,
  PriceRange,
  Quote,
  QuoteLookup
} from '@/domain/MarketDataProvider';

type SeededPrice = Omit<Quote, 'source'>;

export const FAKE_MARKET_DATA_SOURCE = 'fake';

/** An exchange rate is seeded under the codes of its pair, as `USDBRL` for one dollar in reais. */
export class FakeMarketDataProvider implements MarketDataProvider {
  private readonly pricesBySymbol: ReadonlyMap<string, Quote[]>;
  private readonly isAvailable: boolean;

  constructor(
    seededPrices: Record<string, [SeededPrice, ...SeededPrice[]]>,
    { isAvailable = true } = {}
  ) {
    this.pricesBySymbol = new Map<string, Quote[]>(
      Object.entries(seededPrices).map(([symbol, prices]) => [
        symbol,
        prices
          .map((price) => ({ ...price, source: FAKE_MARKET_DATA_SOURCE }))
          .toSorted((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      ])
    );
    this.isAvailable = isAvailable;
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
    { from, to }: PriceRange,
    _interval: PriceInterval
  ): Promise<PriceHistoryLookup> {
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
