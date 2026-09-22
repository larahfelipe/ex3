import { AssetMessages, InstrumentMessages } from '@/config';
import { isQuotedCurrencyOf } from '@/domain/InstrumentCatalog';
import type {
  Instrument,
  InstrumentRegistration,
  Position
} from '@/domain/models';
import { ConflictError, DomainError, NotFoundError } from '@/errors';
import type {
  AssetRepository,
  InstrumentRepository,
  PortfolioRepository
} from '@/infra/database';

import { requireOwnedPortfolio } from '../PortfolioAccess';

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

  /**
   * With attributes, the symbol is registered as a private instrument of the
   * caller, refused when the caller already sees an instrument of that symbol:
   * the catalog one is picked instead of duplicated. Without them, the symbol
   * names the instrument the caller sees.
   */
  async execute({
    userId,
    portfolioId,
    symbol,
    instrument
  }: CreateAssetService.DTO): Promise<CreateAssetService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const visibleInstrument =
      await this.instrumentRepository.getVisibleBySymbol({ symbol, userId });

    const asset =
      instrument === undefined
        ? await this.addVisibleInstrument(portfolio.id, visibleInstrument)
        : await this.addPrivateInstrument(portfolio.id, visibleInstrument, {
            ...instrument,
            symbol,
            ownerId: userId
          });

    return {
      asset,
      message: AssetMessages.CREATED
    };
  }

  private async addVisibleInstrument(
    portfolioId: Position['portfolioId'],
    visibleInstrument: Instrument | null
  ) {
    if (!visibleInstrument)
      throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    const newAsset = await this.assetRepository.add({
      instrumentId: visibleInstrument.id,
      portfolioId
    });

    if (!newAsset) throw new ConflictError(AssetMessages.ALREADY_EXISTS);

    return newAsset;
  }

  private async addPrivateInstrument(
    portfolioId: Position['portfolioId'],
    visibleInstrument: Instrument | null,
    instrument: InstrumentRegistration & Record<'ownerId', string>
  ) {
    if (visibleInstrument?.ownerId === null)
      throw new ConflictError(InstrumentMessages.ALREADY_EXISTS);

    if (visibleInstrument)
      throw new ConflictError(InstrumentMessages.PRIVATE_ALREADY_EXISTS);

    if (!isQuotedCurrencyOf(instrument))
      throw new DomainError(InstrumentMessages.CURRENCY_MISMATCH);

    const newAsset = await this.assetRepository.addWithPrivateInstrument({
      instrument,
      portfolioId
    });

    if (!newAsset)
      throw new ConflictError(InstrumentMessages.PRIVATE_ALREADY_EXISTS);

    return newAsset;
  }
}

namespace CreateAssetService {
  export type DTO = Pick<Position, 'symbol' | 'portfolioId'> &
    Record<'userId', string> & {
      instrument?: Omit<InstrumentRegistration, 'symbol'>;
    };
  export type Result = {
    asset: Position;
    message: string;
  };
}
