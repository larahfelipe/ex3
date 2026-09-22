import {
  toVisibleInstrument,
  type VisibleInstrument
} from '@/domain/InstrumentCatalog';
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
    userId,
    page,
    limit,
    search
  }: GetAllInstrumentsService.DTO): Promise<GetAllInstrumentsService.Result> {
    const { pagination, docs } = await this.instrumentRepository.getAllVisible({
      userId,
      page,
      limit,
      search
    });

    return { pagination, instruments: docs.map(toVisibleInstrument) };
  }
}

namespace GetAllInstrumentsService {
  export type DTO = Record<'userId', string> & {
    page?: number;
    limit?: number;
    search?: string;
  };
  export type Result = {
    instruments: Array<VisibleInstrument>;
    pagination: Record<'page' | 'limit' | 'total' | 'totalPages', number>;
  };
}
