import { AssetMessages, PortfolioMessages } from '@/config';
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
    userId
  }: GetTransactionsCountService.DTO): Promise<GetTransactionsCountService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { docs: assets } = await this.assetRepository.getAll({
      portfolioId: portfolioExists.id
    });

    const assetExists = assets?.find((a) => a.symbol === assetSymbol);

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const [buyCount, sellCount] = await Promise.all([
      this.transactionRepository.count({ type: 'BUY' }),
      this.transactionRepository.count({ type: 'SELL' })
    ]);

    return {
      buy: buyCount,
      sell: sellCount
    };
  }
}

namespace GetTransactionsCountService {
  export type DTO = Record<'assetSymbol' | 'userId', string>;
  export type Result = Record<'buy' | 'sell', number>;
}
