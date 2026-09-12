import { AssetMessages, PortfolioMessages, TransactionTypes } from '@/config';
import { NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class GetTransactionsCountService {
  private static INSTANCE: GetTransactionsCountService;
  private readonly transactionRepository: TransactionRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly assetRepository: AssetRepository;

  private constructor(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository,
    assetRepository: AssetRepository
  ) {
    this.transactionRepository = transactionRepository;
    this.portfolioRepository = portfolioRepository;
    this.assetRepository = assetRepository;
  }

  static getInstance(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository,
    assetRepository: AssetRepository
  ) {
    if (!GetTransactionsCountService.INSTANCE)
      GetTransactionsCountService.INSTANCE = new GetTransactionsCountService(
        transactionRepository,
        portfolioRepository,
        assetRepository
      );

    return GetTransactionsCountService.INSTANCE;
  }

  async execute({
    assetSymbol,
    portfolioId,
    userId
  }: GetTransactionsCountService.DTO): Promise<GetTransactionsCountService.Result> {
    const portfolioExists = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getBySymbol({
      symbol: assetSymbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const assetScope = {
      instrumentId: assetExists.instrumentId,
      portfolioId: portfolioExists.id
    };

    const [buyCount, sellCount] = await Promise.all([
      this.transactionRepository.count({
        ...assetScope,
        type: TransactionTypes.BUY
      }),
      this.transactionRepository.count({
        ...assetScope,
        type: TransactionTypes.SELL
      })
    ]);

    return {
      buy: buyCount,
      sell: sellCount
    };
  }
}

namespace GetTransactionsCountService {
  export type DTO = Record<'assetSymbol' | 'portfolioId' | 'userId', string>;
  export type Result = Record<'buy' | 'sell', number>;
}
