import { AssetMessages, PortfolioMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class GetAllTransactionsService {
  private static INSTANCE: GetAllTransactionsService;
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
    if (!GetAllTransactionsService.INSTANCE)
      GetAllTransactionsService.INSTANCE = new GetAllTransactionsService(
        transactionRepository,
        portfolioRepository,
        assetRepository
      );

    return GetAllTransactionsService.INSTANCE;
  }

  async execute({
    assetSymbol,
    portfolioId,
    userId,
    page,
    limit,
    lastId
  }: GetAllTransactionsService.DTO): Promise<GetAllTransactionsService.Result> {
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

    const { pagination, docs: transactions } =
      await this.transactionRepository.getAll({
        page,
        limit,
        lastId,
        instrumentId: assetExists.instrumentId,
        portfolioId: portfolioExists.id
      });

    return {
      pagination,
      transactions: transactions as Array<Transaction>
    };
  }
}

namespace GetAllTransactionsService {
  export type DTO = {
    assetSymbol: string;
    portfolioId: string;
    userId: string;
    page?: number;
    limit?: number;
    lastId?: string;
  };
  export type Result = {
    transactions: Array<Transaction>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      lastId: string | null;
    };
  };
}
