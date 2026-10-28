import {
  AssetMessages,
  InstrumentMessages,
  MarketDataMessages
} from '@/config';
import { isQuotedCurrencyOf } from '@/domain/InstrumentCatalog';
import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import type { Instrument, Position } from '@/domain/models';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  UnavailableError
} from '@/errors';
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
  private readonly marketDataProvider: MarketDataProvider;

  private constructor(
    assetRepository: AssetRepository,
    instrumentRepository: InstrumentRepository,
    portfolioRepository: PortfolioRepository,
    marketDataProvider: MarketDataProvider
  ) {
    this.assetRepository = assetRepository;
    this.instrumentRepository = instrumentRepository;
    this.portfolioRepository = portfolioRepository;
    this.marketDataProvider = marketDataProvider;
  }

  static getInstance(
    assetRepository: AssetRepository,
    instrumentRepository: InstrumentRepository,
    portfolioRepository: PortfolioRepository,
    marketDataProvider: MarketDataProvider
  ) {
    if (!CreateAssetService.INSTANCE)
      CreateAssetService.INSTANCE = new CreateAssetService(
        assetRepository,
        instrumentRepository,
        portfolioRepository,
        marketDataProvider
      );

    return CreateAssetService.INSTANCE;
  }

  /**
   * With a listing, the symbol is registered as a private instrument of the
   * caller, with the name, type and sector the quote provider lists it under,
   * refused when the caller already sees an instrument of that symbol: the
   * catalog one is picked instead of duplicated. Without one, the symbol names
   * the instrument the caller sees.
   */
  async execute({
    userId,
    portfolioId,
    symbol,
    listing
  }: CreateAssetService.DTO): Promise<CreateAssetService.Result> {
    const portfolio = await requireOwnedPortfolio(this.portfolioRepository, {
      userId,
      portfolioId
    });

    const visibleInstrument =
      await this.instrumentRepository.getVisibleBySymbol({ symbol, userId });

    const asset =
      listing === undefined
        ? await this.addVisibleInstrument(portfolio.id, visibleInstrument)
        : await this.addListedInstrument(portfolio.id, visibleInstrument, {
            ...listing,
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

  /** Every refusal the request alone decides comes before the quote provider is asked. */
  private async addListedInstrument(
    portfolioId: Position['portfolioId'],
    visibleInstrument: Instrument | null,
    { ownerId, ...listed }: CreateAssetService.ListedInstrument
  ) {
    if (visibleInstrument?.ownerId === null)
      throw new ConflictError(InstrumentMessages.ALREADY_EXISTS);

    if (visibleInstrument)
      throw new ConflictError(InstrumentMessages.PRIVATE_ALREADY_EXISTS);

    if (!isQuotedCurrencyOf(listed))
      throw new DomainError(InstrumentMessages.CURRENCY_MISMATCH);

    const lookup = await this.marketDataProvider.describeListing(listed);

    if (lookup.outcome === 'not-found')
      throw new NotFoundError(InstrumentMessages.NOT_LISTED);

    if (lookup.outcome === 'unavailable')
      throw new UnavailableError(MarketDataMessages.UNAVAILABLE);

    const { sector, ...listing } = lookup.listing;

    const newAsset = await this.assetRepository.addWithPrivateInstrument({
      instrument: { ...listing, ...(sector !== null && { sector }), ownerId },
      portfolioId
    });

    if (!newAsset)
      throw new ConflictError(InstrumentMessages.PRIVATE_ALREADY_EXISTS);

    return newAsset;
  }
}

namespace CreateAssetService {
  export type ListingReference = Record<'market' | 'currency', string>;
  export type ListedInstrument = ListingReference &
    Record<'symbol' | 'ownerId', string>;
  export type DTO = Pick<Position, 'symbol' | 'portfolioId'> &
    Record<'userId', string> & {
      listing?: ListingReference;
    };
  export type Result = {
    asset: Position;
    message: string;
  };
}
