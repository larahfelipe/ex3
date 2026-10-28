import { InstrumentMessages } from '@/config';
import {
  isQuotedCurrencyOf,
  toVisibleInstrument,
  type VisibleInstrument
} from '@/domain/InstrumentCatalog';
import type { InstrumentRegistration, User } from '@/domain/models';
import { AuthorizationError, ConflictError, DomainError } from '@/errors';
import type { InstrumentRepository } from '@/infra/database';

/**
 * The catalog is shared by every user, so only an admin writes to it: a user
 * picks a catalog instrument or registers a private one along with the asset
 * that holds it.
 */
export class CreateInstrumentService {
  private static INSTANCE: CreateInstrumentService;
  private readonly instrumentRepository: InstrumentRepository;

  private constructor(instrumentRepository: InstrumentRepository) {
    this.instrumentRepository = instrumentRepository;
  }

  static getInstance(instrumentRepository: InstrumentRepository) {
    if (!CreateInstrumentService.INSTANCE)
      CreateInstrumentService.INSTANCE = new CreateInstrumentService(
        instrumentRepository
      );

    return CreateInstrumentService.INSTANCE;
  }

  async execute({
    isAdmin,
    ...attributes
  }: CreateInstrumentService.DTO): Promise<CreateInstrumentService.Result> {
    if (!isAdmin) throw new AuthorizationError();

    if (!isQuotedCurrencyOf(attributes))
      throw new DomainError(InstrumentMessages.CURRENCY_MISMATCH);

    const instrument = await this.instrumentRepository.add(attributes);

    if (!instrument) throw new ConflictError(InstrumentMessages.ALREADY_EXISTS);

    return {
      instrument: toVisibleInstrument(instrument),
      message: InstrumentMessages.CREATED
    };
  }
}

namespace CreateInstrumentService {
  export type DTO = InstrumentRegistration & Pick<User, 'isAdmin'>;
  export type Result = {
    instrument: VisibleInstrument;
    message: string;
  };
}
