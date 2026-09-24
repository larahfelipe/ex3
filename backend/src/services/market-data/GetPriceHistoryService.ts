import { InstrumentMessages } from '@/config';
import type {
  MarketDataProvider,
  PriceInterval,
  PricedInstrument,
  PriceRange
} from '@/domain/MarketDataProvider';
import type { Instrument, MarketQuote } from '@/domain/models';
import { missingRangesOf } from '@/domain/PriceHistory';
import { NotFoundError } from '@/errors';
import type {
  InstrumentRepository,
  MarketQuoteRepository
} from '@/infra/database';

const DAILY_INTERVAL: PriceInterval = '1d';

type BackfilledInstrument = PricedInstrument & Pick<Instrument, 'id'>;

export class GetPriceHistoryService {
  private static INSTANCE: GetPriceHistoryService;
  private readonly instrumentRepository: InstrumentRepository;
  private readonly marketQuoteRepository: MarketQuoteRepository;
  private readonly marketDataProvider: MarketDataProvider;
  private readonly now: () => Date;

  private constructor(
    instrumentRepository: InstrumentRepository,
    marketQuoteRepository: MarketQuoteRepository,
    marketDataProvider: MarketDataProvider,
    now: () => Date
  ) {
    this.instrumentRepository = instrumentRepository;
    this.marketQuoteRepository = marketQuoteRepository;
    this.marketDataProvider = marketDataProvider;
    this.now = now;
  }

  static getInstance(
    instrumentRepository: InstrumentRepository,
    marketQuoteRepository: MarketQuoteRepository,
    marketDataProvider: MarketDataProvider,
    now: () => Date = () => new Date()
  ) {
    if (!GetPriceHistoryService.INSTANCE)
      GetPriceHistoryService.INSTANCE = new GetPriceHistoryService(
        instrumentRepository,
        marketQuoteRepository,
        marketDataProvider,
        now
      );

    return GetPriceHistoryService.INSTANCE;
  }

  /**
   * The daily closes of an instrument from `from`, inclusive, to `to`,
   * exclusive, in ascending order of `timestamp`. What the range is missing is
   * asked of the provider and recorded before the series is answered; a
   * provider that has no such prices or does not respond leaves the series as
   * what is stored, because an incomplete history is not a failed request.
   */
  async execute({
    instrumentId,
    from,
    to
  }: GetPriceHistoryService.DTO): Promise<GetPriceHistoryService.Result> {
    const instrument = await this.instrumentRepository.getById(instrumentId);

    if (!instrument) throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    const storedCloses = () =>
      this.marketQuoteRepository.getDailyCloses({ instrumentId, from, to });

    const stored = await storedCloses();
    const missingRanges = missingRangesOf(stored, { from, to }, this.now());

    if (missingRanges.length === 0) return stored;

    await Promise.all(
      missingRanges.map((missing) => this.backfill(instrument, missing))
    );

    return storedCloses();
  }

  private async backfill(instrument: BackfilledInstrument, range: PriceRange) {
    const lookup = await this.marketDataProvider.getHistoricalPrices(
      instrument,
      range,
      DAILY_INTERVAL
    );

    if (lookup.outcome !== 'quoted') return;

    await this.marketQuoteRepository.recordDailyCloses({
      instrumentId: instrument.id,
      prices: lookup.prices
    });
  }
}

namespace GetPriceHistoryService {
  export type DTO = Record<'instrumentId', Instrument['id']> & PriceRange;
  export type Result = Array<MarketQuote>;
}
