import type { Prisma } from '@prisma/client';

import type { Instrument, InstrumentRegistration } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

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

  /**
   * A private instrument shadows the catalog one of its symbol, so only the
   * catalog instruments whose symbol the user has not registered are listed.
   */
  async getAllVisible(params: InstrumentRepository.GetAllVisibleParams) {
    const { userId, page, limit, search } = params;

    const privateInstruments = await this.prismaClient.instrument.findMany({
      where: { ownerId: userId },
      select: { symbol: true }
    });

    const visible: Prisma.InstrumentWhereInput = {
      OR: [
        { ownerId: userId },
        {
          ownerId: null,
          symbol: { notIn: privateInstruments.map(({ symbol }) => symbol) }
        }
      ]
    };

    const where: Prisma.InstrumentWhereInput =
      search === undefined
        ? visible
        : {
            AND: [
              visible,
              {
                OR: [
                  { symbol: { startsWith: search.toUpperCase() } },
                  { name: { contains: search, mode: 'insensitive' } }
                ]
              }
            ]
          };

    const [total, docs] = await Promise.all([
      this.prismaClient.instrument.count({ where }),
      this.prismaClient.instrument.findMany({
        where,
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

  async getById(id: string) {
    return this.prismaClient.instrument.findUnique({ where: { id } });
  }

  /**
   * The instrument a symbol names for a user: the private one they registered,
   * else the catalog one. Nulls sort last, so a private instrument shadows the
   * catalog instrument of its symbol.
   */
  async getVisibleBySymbol(params: InstrumentRepository.GetVisibleParams) {
    const { symbol, userId } = params;

    return this.prismaClient.instrument.findFirst({
      where: { symbol, OR: [{ ownerId: userId }, { ownerId: null }] },
      orderBy: { ownerId: { sort: 'asc', nulls: 'last' } }
    });
  }

  /**
   * The unique index on owner and symbol, which counts every catalog instrument
   * as one owner, is the only authority on whether the symbol is free, so of
   * concurrent registrations of one symbol exactly one succeeds and the others
   * resolve to null.
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
    const { id, ...attributes } = params;

    return this.prismaClient.instrument.update({
      where: { id },
      data: attributes
    });
  }
}

namespace InstrumentRepository {
  export type GetAllVisibleParams = Record<'userId', string> &
    Record<'page' | 'limit', number> &
    Partial<Record<'search', string>>;
  export type GetVisibleParams = Pick<Instrument, 'symbol'> &
    Record<'userId', string>;
  export type AddParams = InstrumentRegistration;
  export type UpdateParams = Pick<Instrument, 'id'> &
    Partial<Omit<InstrumentRegistration, 'symbol'>>;
}
