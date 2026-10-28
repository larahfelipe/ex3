import { AssetMessages } from '@/config';
import type { Portfolio } from '@/domain/models';
import {
  describePositionIndicators,
  indicatorClosesRangeOf,
  type PositionIndicators
} from '@/domain/PositionIndicators';
import { NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
import type { GetPriceHistoryService } from '@/services/market-data';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class GetPositionIndicatorsService {
  private static INSTANCE: GetPositionIndicatorsService;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly transactionRepository: TransactionRepository;
  private readonly getPriceHistoryService: GetPriceHistoryService;
  private readonly now: () => Date;

  private constructor(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository,
    getPriceHistoryService: GetPriceHistoryService,
    now: () => Date
  ) {
    this.assetRepository = assetRepository;
    this.portfolioRepository = portfolioRepository;
    this.transactionRepository = transactionRepository;
    this.getPriceHistoryService = getPriceHistoryService;
    this.now = now;
  }

  static getInstance(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository,
    getPriceHistoryService: GetPriceHistoryService,
    now: () => Date = () => new Date()
  ) {
    if (!GetPositionIndicatorsService.INSTANCE)
      GetPositionIndicatorsService.INSTANCE = new GetPositionIndicatorsService(
        assetRepository,
        portfolioRepository,
        transactionRepository,
        getPriceHistoryService,
        now
      );

    return GetPositionIndicatorsService.INSTANCE;
  }

  /**
   * The ledger is read up to the moment of the request, so a transaction dated
   * later has not realized a result or paid income yet.
   */
  async execute({
    userId,
    portfolioId,
    symbol
  }: GetPositionIndicatorsService.DTO): Promise<GetPositionIndicatorsService.Result> {
    await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const position = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId
    });

    if (!position) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const now = this.now();
    const { instrumentId, investedValue } = position;

    const [ledger, closes] = await Promise.all([
      this.transactionRepository.getLedgerUpTo({
        portfolioId,
        instrumentId,
        to: now
      }),
      this.getPriceHistoryService.execute({
        instrumentId,
        ...indicatorClosesRangeOf(now)
      })
    ]);

    return describePositionIndicators({ now, closes, ledger, investedValue });
  }
}

namespace GetPositionIndicatorsService {
  export type DTO = Record<'userId' | 'symbol', string> &
    Record<'portfolioId', Portfolio['id']>;
  export type Result = PositionIndicators;
}
