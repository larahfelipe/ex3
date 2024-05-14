import { AssetMessages, PortfolioMessages } from '@/config';
import type { Asset } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class DeleteAssetService {
  private static INSTANCE: DeleteAssetService;
  private readonly assetRepository: AssetRepository;
  private readonly portfolioRepository: PortfolioRepository;
  private readonly transactionRepository: TransactionRepository;

  private constructor(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository
  ) {
    this.assetRepository = assetRepository;
    this.portfolioRepository = portfolioRepository;
    this.transactionRepository = transactionRepository;
  }

  static getInstance(
    assetRepository: AssetRepository,
    portfolioRepository: PortfolioRepository,
    transactionRepository: TransactionRepository
  ) {
    if (!DeleteAssetService.INSTANCE)
      DeleteAssetService.INSTANCE = new DeleteAssetService(
        assetRepository,
        portfolioRepository,
        transactionRepository
      );

    return DeleteAssetService.INSTANCE;
  }

  async execute({
    userId,
    symbol
  }: DeleteAssetService.DTO): Promise<DeleteAssetService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetExists = await this.assetRepository.getBySymbol({
      symbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new BadRequestError(AssetMessages.NOT_FOUND);

    const assetHasTransactions = await this.transactionRepository.count();

    if (assetHasTransactions)
      await this.transactionRepository.deleteAllByAssetSymbol(
        assetExists.symbol
      );

    await this.assetRepository.delete({
      symbol,
      portfolioId: portfolioExists.id
    });

    return {
      message: AssetMessages.DELETED
    };
  }
}

namespace DeleteAssetService {
  export type DTO = Pick<Asset, 'symbol'> & Record<'userId', string>;
  export type Result = Record<'message', string>;
}
