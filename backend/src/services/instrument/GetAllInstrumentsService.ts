import type { Instrument } from '@/domain/models';
import type { InstrumentRepository } from '@/infra/database';

export class GetAllInstrumentsService {
  private static INSTANCE: GetAllInstrumentsService;
  private readonly instrumentRepository: InstrumentRepository;

  private constructor(instrumentRepository: InstrumentRepository) {
    this.instrumentRepository = instrumentRepository;
  }

  static getInstance(instrumentRepository: InstrumentRepository) {
    if (!GetAllInstrumentsService.INSTANCE)
      GetAllInstrumentsService.INSTANCE = new GetAllInstrumentsService(
        instrumentRepository
      );

    return GetAllInstrumentsService.INSTANCE;
  }

  async execute({
    page,
    limit
  }: GetAllInstrumentsService.DTO): Promise<GetAllInstrumentsService.Result> {
    const { pagination, docs: instruments } =
      await this.instrumentRepository.getAll({ page, limit });

    return { pagination, instruments };
  }
}

namespace GetAllInstrumentsService {
  export type DTO = {
    page?: number;
    limit?: number;
  };
  export type Result = {
    instruments: Array<Instrument>;
    pagination: Record<'page' | 'limit' | 'total' | 'totalPages', number>;
  };
}
