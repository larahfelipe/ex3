import { AssetMessages, PortfolioMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { ForbiddenError, NotFoundError } from '@/errors';
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
    userIsStaff
  }: GetAllTransactionsService.DTO) {
    let allTransactions = [];

    if (!userIsStaff && !assetId?.length) throw new ForbiddenError();

    if (!userIsStaff) {
      const portfolioExists = await this.portfolioRepository.getByUserId(
        userId
      );

      if (!portfolioExists)
        throw new NotFoundError(PortfolioMessages.NOT_FOUND);

      const allAssets = await this.assetRepository.getAllByPortfolioId(
        portfolioExists.id
      );

      if (!allAssets?.length) throw new NotFoundError(AssetMessages.EMPTY);

      const assetExists = allAssets.find((asset) => asset.id === assetId);

      if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);
    }

    if (assetId) {
      allTransactions = await this.transactionRepository.getAllByAssetId(
        assetId
      );
    } else {
      allTransactions = await this.transactionRepository.getAll();
    }

    const res: GetAllTransactionsService.Result = {
      transactions: allTransactions as Array<Transaction>
    };

    return res;
  }
}

namespace GetAllTransactionsService {
  export type DTO = {
    assetId?: string;
    userId: string;
    userIsStaff: boolean;
  };
  export type Result = Record<'transactions', Array<Transaction>>;
}
