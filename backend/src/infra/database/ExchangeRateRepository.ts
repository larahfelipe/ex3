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
