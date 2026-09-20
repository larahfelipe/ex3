import { AssetMessages, InstrumentMessages } from '@/config';
import { ConflictError, NotFoundError } from '@/errors';
import type {
  AssetRepository,
  InstrumentRepository,
  PortfolioRepository
} from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';

export class UpdateAssetService {
  private static INSTANCE: UpdateAssetService;
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
    if (!UpdateAssetService.INSTANCE)
      UpdateAssetService.INSTANCE = new UpdateAssetService(
        assetRepository,
        instrumentRepository,
        portfolioRepository
      );

    return UpdateAssetService.INSTANCE;
  }

  async execute({
    userId,
    portfolioId,
    oldSymbol,
    newSymbol
  }: UpdateAssetService.DTO): Promise<UpdateAssetService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const assetExists = await this.assetRepository.getBySymbol({
      symbol: oldSymbol,
      portfolioId: portfolio.id
    });

    if (!assetExists) throw new NotFoundError(AssetMessages.NOT_FOUND);

    const instrumentExists =
      await this.instrumentRepository.getBySymbol(newSymbol);

    if (!instrumentExists)
      throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    const isMoved =
      instrumentExists.id !== assetExists.instrumentId &&
      (await this.assetRepository.update({
        oldInstrumentId: assetExists.instrumentId,
        newInstrumentId: instrumentExists.id,
        portfolioId: portfolio.id
      }));

    if (!isMoved) throw new ConflictError(AssetMessages.ALREADY_EXISTS);

    return {
      message: AssetMessages.UPDATED
    };
  }
}

namespace UpdateAssetService {
  export type DTO = {
    oldSymbol: string;
    newSymbol: string;
    portfolioId: string;
    userId: string;
  };
  export type Result = {
    message: string;
  };
}
