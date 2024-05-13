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
    assetId,
    userId,
    page,
    limit
  }: GetAllTransactionsService.DTO) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const { docs: assets } = await this.assetRepository.getAll({
      portfolioId: portfolioExists.id
    });

    const assetExists = assets?.find((asset) => asset.id === assetId);

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const { pagination, docs: transactions } =
      await this.transactionRepository.getAll({
        assetId,
        page,
        limit
      });

    const res: GetAllTransactionsService.Result = {
      pagination,
      transactions: transactions as Array<Transaction>
    };

    return res;
  }
}

namespace GetAllTransactionsService {
  export type DTO = {
    assetId: string;
    userId: string;
    page?: number;
    limit?: number;
  };
  export type Result = {
    transactions: Array<Transaction>;
    pagination: Record<'page' | 'limit' | 'total' | 'totalPages', number>;
  };
}
