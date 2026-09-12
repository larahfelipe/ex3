import { InstrumentMessages } from '@/config';
import type { Instrument, User } from '@/domain/models';
import { ForbiddenError, NotFoundError } from '@/errors';
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

  async execute({
    isAdmin,
    symbol,
    attributes
  }: UpdateInstrumentService.DTO): Promise<UpdateInstrumentService.Result> {
    if (!isAdmin) throw new ForbiddenError();

    const instrumentExists =
      await this.instrumentRepository.getBySymbol(symbol);

    if (!instrumentExists)
      throw new NotFoundError(InstrumentMessages.NOT_FOUND);

    const instrument = await this.instrumentRepository.update({
      symbol,
      ...attributes
    });

    return {
      instrument,
      message: InstrumentMessages.UPDATED
    };
  }
}

namespace UpdateInstrumentService {
  export type DTO = Pick<Instrument, 'symbol'> &
    Pick<User, 'isAdmin'> & {
      attributes: Partial<
        Pick<Instrument, 'name' | 'type'> &
          Record<'market' | 'currency' | 'sector' | 'country', string>
      >;
    };
  export type Result = {
    instrument: Instrument;
    message: string;
  };
}
