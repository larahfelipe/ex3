import type { MarketQuote as MarketQuoteRow } from '@prisma/client';

import type { ObservedPrice, PriceRange } from '@/domain/MarketDataProvider';
import type { MarketQuote } from '@/domain/models';
import { startOfDayInUtc } from '@/domain/PriceHistory';

import { PrismaClient } from './PrismaClient';

const toMarketQuote = ({ price, ...quote }: MarketQuoteRow): MarketQuote => ({
  ...quote,
  price: price.toFixed()
});

export class MarketQuoteRepository {
  private static INSTANCE: MarketQuoteRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!MarketQuoteRepository.INSTANCE)
      MarketQuoteRepository.INSTANCE = new MarketQuoteRepository();

    return MarketQuoteRepository.INSTANCE;
  }

  async recordDailyCloses(
    params: MarketQuoteRepository.RecordDailyClosesParams
  ) {
    const { instrumentId, prices } = params;

    const { count } = await this.prismaClient.marketQuote.createMany({
      data: prices.map(({ price, currency, source, timestamp }) => ({
        instrumentId,
        price,
        currency,
        source,
        timestamp: startOfDayInUtc(timestamp)
      })),
      skipDuplicates: true
    });

    return count;
  }

  async getDailyCloses(params: MarketQuoteRepository.GetDailyClosesParams) {
    const { instrumentId, from, to } = params;

    const quotes = await this.prismaClient.marketQuote.findMany({
      where: { instrumentId, timestamp: { gte: from, lt: to } },
      orderBy: { timestamp: 'asc' }
    });

    return quotes.map(toMarketQuote);
  }
}

namespace MarketQuoteRepository {
  export type RecordDailyClosesParams = Pick<MarketQuote, 'instrumentId'> &
    Record<'prices', ReadonlyArray<ObservedPrice>>;
  export type GetDailyClosesParams = Pick<MarketQuote, 'instrumentId'> &
    PriceRange;
}
