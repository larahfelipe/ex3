import { InstrumentMessages } from '@/config';
import {
  isQuotedCurrencyOf,
  toVisibleInstrument,
  type VisibleInstrument
} from '@/domain/InstrumentCatalog';
import type { Instrument, User } from '@/domain/models';
import { AuthorizationError, DomainError, NotFoundError } from '@/errors';
import type { InstrumentRepository } from '@/infra/database';

export class UpdateInstrumentService {
  private static INSTANCE: UpdateInstrumentService;
  private readonly instrumentRepository: InstrumentRepository;

  private constructor(instrumentRepository: InstrumentRepository) {
    this.instrumentRepository = instrumentRepository;
  }

  static getInstance(instrumentRepository: InstrumentRepository) {
    if (!UpdateInstrumentService.INSTANCE)
      UpdateInstrumentService.INSTANCE = new UpdateInstrumentService(
        instrumentRepository
      );

    return UpdateInstrumentService.INSTANCE;
  }

  /**
   * The symbol names the instrument the caller sees. A private one is only ever
   * seen by its owner, who may change it; the catalog is written by an admin.
   */
  async execute({
    userId,
    isAdmin,
    symbol,
    attributes
  }: UpdateInstrumentService.DTO): Promise<UpdateInstrumentService.Result> {
    const instrumentExists = await this.instrumentRepository.getVisibleBySymbol(
      { symbol, userId }
    );

    if (!instrumentExists)
      throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    if (instrumentExists.ownerId === null && !isAdmin)
      throw new AuthorizationError();

    const isQuoted = isQuotedCurrencyOf({
      market: attributes.market ?? instrumentExists.market,
      currency: attributes.currency ?? instrumentExists.currency
    });

    if (!isQuoted) throw new DomainError(InstrumentMessages.CURRENCY_MISMATCH);

    const instrument = await this.instrumentRepository.update({
      id: instrumentExists.id,
      ...attributes
    });

    return {
      instrument: toVisibleInstrument(instrument),
      message: InstrumentMessages.UPDATED
    };
  }
}

namespace UpdateInstrumentService {
  export type DTO = Pick<Instrument, 'symbol'> &
    Pick<User, 'isAdmin'> &
    Record<'userId', string> & {
      attributes: Partial<
        Pick<Instrument, 'name' | 'type'> &
          Record<'market' | 'currency' | 'sector' | 'country', string>
      >;
    };
  export type Result = {
    instrument: VisibleInstrument;
    message: string;
  };
}
