import { AssetMessages, InstrumentMessages, PortfolioMessages } from '@/config';
import type { Position } from '@/domain/models';
import { ConflictError, NotFoundError } from '@/errors';
import type {
  AssetRepository,
  InstrumentRepository,
  PortfolioRepository
} from '@/infra/database';

export class CreateAssetService {
  private static INSTANCE: CreateAssetService;
  private readonly assetRepository: AssetRepository;
  private readonly instrumentRepository: InstrumentRepository;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(
    assetRepository: AssetRepository,
    instrumentRepository: InstrumentRepository,
    portfolioRepository: PortfolioRepository
  ) {
    this.assetRepository = assetRepository;
    this.instrumentRepository = instrumentRepository;
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(
    assetRepository: AssetRepository,
    instrumentRepository: InstrumentRepository,
    portfolioRepository: PortfolioRepository
  ) {
    if (!CreateAssetService.INSTANCE)
      CreateAssetService.INSTANCE = new CreateAssetService(
        assetRepository,
        instrumentRepository,
        portfolioRepository
      );

    return CreateAssetService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    symbol
  }: CreateAssetService.DTO): Promise<CreateAssetService.Result> {
    const portfolioExists = await this.portfolioRepository.getById({
      id: portfolioId,
      userId
    });

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const instrumentExists =
      await this.instrumentRepository.getBySymbol(symbol);

    if (!instrumentExists)
      throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    const newAsset = await this.assetRepository.add({
      instrumentId: instrumentExists.id,
      portfolioId: portfolioExists.id
    });

    if (!newAsset) throw new ConflictError(AssetMessages.ALREADY_EXISTS);

    return {
      asset: newAsset,
      message: AssetMessages.CREATED
    };
  }
}

namespace CreateAssetService {
  export type DTO = Pick<Position, 'symbol' | 'portfolioId'> &
    Record<'userId', string>;
  export type Result = {
    asset: Position;
    message: string;
  };
}
