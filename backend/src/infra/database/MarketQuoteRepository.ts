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

  /**
   * Each price is the close of a trading day, keyed by the start of that day in
   * UTC. The unique index on instrument, day and source is the only authority on
   * whether a day is already recorded, so a day recorded twice keeps the price
   * first observed and concurrent backfills of one day write it once. Resolves
   * to how many days were new.
   */
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

  /**
   * The closes stored for the instrument from `from`, inclusive, to `to`,
   * exclusive, in ascending order of day. Every source is answered, so a day
   * observed by two sources is two entries.
   */
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
