import { InstrumentMessages } from '@/config';
import type { Instrument, User } from '@/domain/models';
import { AuthorizationError, ConflictError } from '@/errors';
import type { InstrumentRepository } from '@/infra/database';

/**
 * The catalog is shared by every portfolio, so only an admin writes to it:
 * a user picks an instrument that already exists.
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

    const instrument = await this.instrumentRepository.add(attributes);

    if (!instrument) throw new ConflictError(InstrumentMessages.ALREADY_EXISTS);

    return {
      instrument,
      message: InstrumentMessages.CREATED
    };
  }
}

namespace CreateInstrumentService {
  export type DTO = Pick<Instrument, 'symbol' | 'name' | 'type'> &
    Record<'market' | 'currency', string> &
    Partial<Record<'sector' | 'country', string>> &
    Pick<User, 'isAdmin'>;
  export type Result = {
    instrument: Instrument;
    message: string;
  };
}
