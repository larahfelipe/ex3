import type { ObservedPrice } from '@/domain/MarketDataProvider';
import type { MarketQuote } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

const startOfDayInUtc = (instant: Date) =>
  new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate()
    )
  );

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
}

namespace MarketQuoteRepository {
  export type RecordDailyClosesParams = Pick<MarketQuote, 'instrumentId'> &
    Record<'prices', ReadonlyArray<ObservedPrice>>;
}
