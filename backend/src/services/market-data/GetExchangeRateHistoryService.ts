import type {
  MarketDataProvider,
  PriceRange
} from '@/domain/MarketDataProvider';
import type { ExchangeRate } from '@/domain/models';
import { missingRangesOf } from '@/domain/PriceHistory';
import type { ExchangeRateRepository } from '@/infra/database';

export class GetExchangeRateHistoryService {
  private static INSTANCE: GetExchangeRateHistoryService;
  private readonly exchangeRateRepository: ExchangeRateRepository;
  private readonly marketDataProvider: MarketDataProvider;
  private readonly now: () => Date;

  private constructor(
    exchangeRateRepository: ExchangeRateRepository,
    marketDataProvider: MarketDataProvider,
    now: () => Date
  ) {
    this.exchangeRateRepository = exchangeRateRepository;
    this.marketDataProvider = marketDataProvider;
    this.now = now;
  }

  static getInstance(
    exchangeRateRepository: ExchangeRateRepository,
    marketDataProvider: MarketDataProvider,
    now: () => Date = () => new Date()
  ) {
    if (!GetExchangeRateHistoryService.INSTANCE)
      GetExchangeRateHistoryService.INSTANCE =
        new GetExchangeRateHistoryService(
          exchangeRateRepository,
          marketDataProvider,
          now
        );

    return GetExchangeRateHistoryService.INSTANCE;
  }

  /**
   * The daily rates of each currency to `baseCurrency` from `from`, inclusive,
   * to `to`, exclusive, keyed by currency. What the range is missing is asked of
   * the provider and recorded before the rates are answered, as the price
   * history is, and a provider that does not answer leaves what is stored. The
   * base currency is never asked: one unit of it is worth one.
   */
  async execute({
    currencies,
    baseCurrency,
    from,
    to
  }: GetExchangeRateHistoryService.DTO): Promise<GetExchangeRateHistoryService.Result> {
    const foreignCurrencies = [...new Set(currencies)].filter(
      (currency) => currency !== baseCurrency
    );

    return new Map(
      await Promise.all(
        foreignCurrencies.map(
          async (currency) =>
            [
              currency,
              await this.ratesOf(currency, baseCurrency, { from, to })
            ] as const
        )
      )
    );
  }

  private async ratesOf(
    currency: string,
    baseCurrency: string,
    range: PriceRange
  ) {
    const storedRates = () =>
      this.exchangeRateRepository.getDailyRates({
        currency,
        baseCurrency,
        ...range
      });

    const stored = await storedRates();
    const missingRanges = missingRangesOf(stored, range, this.now());

    if (missingRanges.length === 0) return stored;

    await Promise.all(
      missingRanges.map((missing) =>
        this.backfill(currency, baseCurrency, missing)
      )
    );

    return storedRates();
  }

  private async backfill(
    currency: string,
    baseCurrency: string,
    range: PriceRange
  ) {
    const lookup = await this.marketDataProvider.getHistoricalExchangeRate(
      currency,
      baseCurrency,
      range
    );

    if (lookup.outcome !== 'quoted') return;

    await this.exchangeRateRepository.recordDailyRates({
      currency,
      baseCurrency,
      rates: lookup.prices
    });
  }
}

namespace GetExchangeRateHistoryService {
  export type DTO = Record<'currencies', ReadonlyArray<string>> &
    Pick<ExchangeRate, 'baseCurrency'> &
    PriceRange;
  export type Result = ReadonlyMap<string, Array<ExchangeRate>>;
}
