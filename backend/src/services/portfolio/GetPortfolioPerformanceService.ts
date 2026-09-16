import { InstrumentMessages, PortfolioMessages } from '@/config';
import type { PriceRange } from '@/domain/MarketDataProvider';
import type { Instrument, Portfolio } from '@/domain/models';
import {
  type DailyPrice,
  type PerformanceRange,
  performanceRangeOf,
  type PortfolioPerformance,
  type QuotedInstrument,
  trackPortfolioPerformance
} from '@/domain/PortfolioPerformance';
import { startOfDayInUtc } from '@/domain/PriceHistory';
import { NotFoundError } from '@/errors';
import type {
  InstrumentRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
import type {
  GetExchangeRateHistoryService,
  GetPriceHistoryService
} from '@/services/market-data';

type TradedInstrument = Pick<Instrument, 'id' | 'symbol' | 'currency'>;

export class GetPortfolioPerformanceService {
  private static INSTANCE: GetPortfolioPerformanceService;
  private readonly instrumentRepository: InstrumentRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly transactionRepository: TransactionRepository;
  private readonly getPriceHistoryService: GetPriceHistoryService;
  private readonly getExchangeRateHistoryService: GetExchangeRateHistoryService;
  private readonly now: () => Date;

  private constructor(
    instrumentRepository: InstrumentRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository,
    getPriceHistoryService: GetPriceHistoryService,
    getExchangeRateHistoryService: GetExchangeRateHistoryService,
    now: () => Date
  ) {
    this.instrumentRepository = instrumentRepository;
    this.portfolioRepository = portfolioRepository;
    this.transactionRepository = transactionRepository;
    this.getPriceHistoryService = getPriceHistoryService;
    this.getExchangeRateHistoryService = getExchangeRateHistoryService;
    this.now = now;
  }

  static getInstance(
    instrumentRepository: InstrumentRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository,
    getPriceHistoryService: GetPriceHistoryService,
    getExchangeRateHistoryService: GetExchangeRateHistoryService,
    now: () => Date = () => new Date()
  ) {
    if (!GetPortfolioPerformanceService.INSTANCE)
      GetPortfolioPerformanceService.INSTANCE =
        new GetPortfolioPerformanceService(
          instrumentRepository,
          portfolioRepository,
          transactionRepository,
          getPriceHistoryService,
          getExchangeRateHistoryService,
          now
        );

    return GetPortfolioPerformanceService.INSTANCE;
  }

  /**
   * The whole ledger up to today is read, not only the window's, because the
   * positions held on the first day of the window are replayed from every
   * transaction that precedes it. `MAX` starts at the first of them.
   */
  async execute({
    userId,
    portfolioId,
    range,
    benchmark
  }: GetPortfolioPerformanceService.DTO): Promise<GetPortfolioPerformanceService.Result> {
    const portfolio = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolio) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { baseCurrency } = portfolio;
    const now = this.now();
    const ledger = await this.transactionRepository.getLedgerUpTo({
      portfolioId,
      to: startOfDayInUtc(now)
    });
    const [firstEntry] = ledger;
    const window = performanceRangeOf(range, now, firstEntry?.executedAt);

    const traded = await this.instrumentRepository.getByIds([
      ...new Set(ledger.map(({ instrumentId }) => instrumentId))
    ]);

    const [instruments, ratesByCurrency, benchmarkSeries] = await Promise.all([
      this.quotedInstruments(traded, window),
      this.ratesOf(
        [
          ...ledger.map(({ currency }) => currency),
          ...traded.flatMap(({ currency }) => currency ?? [])
        ],
        baseCurrency,
        window
      ),
      this.benchmarkOf(benchmark, window)
    ]);

    return trackPortfolioPerformance({
      baseCurrency,
      range: window,
      ledger,
      instruments,
      ratesByCurrency,
      ...(benchmarkSeries && { benchmark: benchmarkSeries })
    });
  }

  private async quotedInstruments(
    traded: ReadonlyArray<TradedInstrument>,
    range: PriceRange
  ): Promise<ReadonlyMap<string, QuotedInstrument>> {
    return new Map(
      await Promise.all(
        traded.map(
          async ({ id, symbol, currency }) =>
            [
              id,
              { symbol, currency, closes: await this.closesOf(symbol, range) }
            ] as const
        )
      )
    );
  }

  private async ratesOf(
    currencies: ReadonlyArray<string>,
    baseCurrency: string,
    range: PriceRange
  ): Promise<ReadonlyMap<string, Array<DailyPrice>>> {
    const rates = await this.getExchangeRateHistoryService.execute({
      currencies,
      baseCurrency,
      ...range
    });

    return new Map(
      [...rates].map(([currency, series]) => [
        currency,
        series.map(({ timestamp, rate }) => ({ timestamp, price: rate }))
      ])
    );
  }

  private async benchmarkOf(
    symbol: string | undefined,
    range: PriceRange
  ): Promise<QuotedInstrument | null> {
    if (symbol === undefined) return null;

    const instrument = await this.instrumentRepository.getBySymbol(symbol);

    if (!instrument) throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    return {
      symbol: instrument.symbol,
      currency: instrument.currency,
      closes: await this.closesOf(instrument.symbol, range)
    };
  }

  private closesOf(
    symbol: string,
    range: PriceRange
  ): Promise<Array<DailyPrice>> {
    return this.getPriceHistoryService.execute({ symbol, ...range });
  }
}

namespace GetPortfolioPerformanceService {
  export type DTO = Record<'userId', string> &
    Record<'portfolioId', Portfolio['id']> &
    Record<'range', PerformanceRange> &
    Partial<Record<'benchmark', string>>;
  export type Result = PortfolioPerformance;
}
