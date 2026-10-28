import type { ExchangeRate as ExchangeRateRow } from '@prisma/client';

import type { ObservedPrice, PriceRange } from '@/domain/MarketDataProvider';
import type { ExchangeRate } from '@/domain/models';
import { startOfDayInUtc } from '@/domain/PriceHistory';

import { PrismaClient } from './PrismaClient';

const toExchangeRate = ({ rate, ...row }: ExchangeRateRow): ExchangeRate => ({
  ...row,
  rate: rate.toFixed()
});

export class ExchangeRateRepository {
  private static INSTANCE: ExchangeRateRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!ExchangeRateRepository.INSTANCE)
      ExchangeRateRepository.INSTANCE = new ExchangeRateRepository();

    return ExchangeRateRepository.INSTANCE;
  }

  /**
   * Each rate is the close of a trading day, the price of one unit of
   * `currency` in `baseCurrency`, keyed by the start of that day in UTC. The
   * pair comes from the caller, not from the prices: a pair is quoted in the
   * base currency, so the currency a price carries is the base one. The unique
   * index on pair, day and source is the only authority on whether a day is
   * already recorded, so a day recorded twice keeps the rate first observed and
   * concurrent backfills of one day write it once. Resolves to how many days
   * were new.
   */
  async recordDailyRates(
    params: ExchangeRateRepository.RecordDailyRatesParams
  ) {
    const { currency, baseCurrency, rates } = params;

    const { count } = await this.prismaClient.exchangeRate.createMany({
      data: rates.map(({ price, source, timestamp }) => ({
        currency,
        baseCurrency,
        rate: price,
        source,
        timestamp: startOfDayInUtc(timestamp)
      })),
      skipDuplicates: true
    });

    return count;
  }

  /**
   * The rates stored for the pair from `from`, inclusive, to `to`, exclusive, in
   * ascending order of day. Every source is answered, so a day observed by two
   * sources is two entries.
   */
  async getDailyRates(params: ExchangeRateRepository.GetDailyRatesParams) {
    const { currency, baseCurrency, from, to } = params;

    const rates = await this.prismaClient.exchangeRate.findMany({
      where: { currency, baseCurrency, timestamp: { gte: from, lt: to } },
      orderBy: { timestamp: 'asc' }
    });

    return rates.map(toExchangeRate);
  }
}

namespace ExchangeRateRepository {
  export type RecordDailyRatesParams = Pick<
    ExchangeRate,
    'currency' | 'baseCurrency'
  > &
    Record<'rates', ReadonlyArray<ObservedPrice>>;
  export type GetDailyRatesParams = Pick<
    ExchangeRate,
    'currency' | 'baseCurrency'
  > &
    PriceRange;
}
