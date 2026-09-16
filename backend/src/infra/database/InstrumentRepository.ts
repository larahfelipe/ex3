import type { Instrument } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

const DEFAULT_PAGE_LIMIT = 10;

export class InstrumentRepository {
  private static INSTANCE: InstrumentRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!InstrumentRepository.INSTANCE)
      InstrumentRepository.INSTANCE = new InstrumentRepository();

    return InstrumentRepository.INSTANCE;
  }

  async getAll(params: InstrumentRepository.GetAllParams) {
    const { page = 1, limit = DEFAULT_PAGE_LIMIT } = params;

    const [total, docs] = await Promise.all([
      this.prismaClient.instrument.count(),
      this.prismaClient.instrument.findMany({
        orderBy: { symbol: 'asc' },
        take: limit,
        skip: (page - 1) * limit
      })
    ]);

    return {
      docs,
      pagination: { page, total, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  async getByIds(ids: ReadonlyArray<string>) {
    return this.prismaClient.instrument.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, symbol: true, currency: true }
    });
  }

  async getBySymbol(symbol: string) {
    return this.prismaClient.instrument.findUnique({ where: { symbol } });
  }

  /**
   * The unique index on symbol is the only authority on whether it is free, so
   * of concurrent registrations of one symbol exactly one succeeds and the
   * others resolve to null.
   */
  async add(params: InstrumentRepository.AddParams) {
    try {
      return await this.prismaClient.instrument.create({ data: params });
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return null;

      throw error;
    }
  }

  async update(params: InstrumentRepository.UpdateParams) {
    const { symbol, ...attributes } = params;

    return this.prismaClient.instrument.update({
      where: { symbol },
      data: attributes
    });
  }
}

namespace InstrumentRepository {
  export type GetAllParams = { page?: number; limit?: number };
  export type AddParams = Pick<Instrument, 'symbol' | 'name' | 'type'> &
    Record<'market' | 'currency', string> &
    Partial<Record<'sector' | 'country', string>>;
  export type UpdateParams = Pick<Instrument, 'symbol'> &
    Partial<Omit<AddParams, 'symbol'>>;
}
