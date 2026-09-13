import type { Position as PositionRow } from '@prisma/client';

import type { SortOrderTypes } from '@/config';
import type { Position } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

const INSTRUMENT_SYMBOL = { instrument: { select: { symbol: true } } } as const;

const toPosition = ({
  instrument,
  quantity,
  averageCost,
  investedValue,
  ...position
}: PositionRow & Record<'instrument', Pick<Position, 'symbol'>>): Position => ({
  ...position,
  quantity: quantity.toFixed(),
  averageCost: averageCost.toFixed(),
  investedValue: investedValue.toFixed(),
  symbol: instrument.symbol
});

export class AssetRepository {
  private static INSTANCE: AssetRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!AssetRepository.INSTANCE)
      AssetRepository.INSTANCE = new AssetRepository();

    return AssetRepository.INSTANCE;
  }

  async getAll(params: AssetRepository.GetAllParams) {
    const { portfolioId, sort, limit, page = 1 } = params;

    const limitPerPage = limit || limit === 0 ? limit : 10;

    const [total, docs] = await Promise.all([
      this.prismaClient.position.count({ where: { portfolioId } }),
      this.prismaClient.position.findMany({
        ...(sort && { orderBy: { investedValue: sort } }),
        ...(limit !== 0 && { take: limitPerPage }),
        where: { portfolioId },
        include: INSTRUMENT_SYMBOL,
        skip: (page - 1) * limitPerPage || 0
      })
    ]);

    const totalPages = Math.ceil(total / limitPerPage);

    return {
      docs: docs.map(toPosition),
      pagination: {
        page,
        total,
        limit: limitPerPage,
        totalPages: totalPages !== Infinity ? totalPages : 1
      }
    };
  }

  async getById(id: string) {
    const position = await this.prismaClient.position.findUnique({
      where: { id },
      include: INSTRUMENT_SYMBOL
    });

    return position && toPosition(position);
  }

  async getBySymbol(params: AssetRepository.GetParams) {
    const { symbol, portfolioId } = params;

    const position = await this.prismaClient.position.findFirst({
      where: { portfolioId, instrument: { symbol } },
      include: INSTRUMENT_SYMBOL
    });

    return position && toPosition(position);
  }

  /**
   * The unique index on portfolio and instrument is the only authority on
   * whether the portfolio already holds the instrument, so of concurrent
   * additions exactly one succeeds and the others resolve to null.
   */
  async add(params: AssetRepository.AddParams) {
    try {
      const position = await this.prismaClient.position.create({
        data: params,
        include: INSTRUMENT_SYMBOL
      });

      return toPosition(position);
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return null;

      throw error;
    }
  }

  /**
   * The position and its transactions move to the new instrument in one
   * serializable transaction, so none is left behind on the old one. Resolves
   * to false, moving nothing, when the portfolio already holds the new one.
   */
  async update(params: AssetRepository.UpdateParams) {
    const { oldInstrumentId, newInstrumentId, portfolioId } = params;

    const heldPosition = { portfolioId, instrumentId: oldInstrumentId };
    const movedPosition = { instrumentId: newInstrumentId };

    try {
      await this.prismaClient.runSerializable(async (transactionClient) => {
        await transactionClient.transaction.updateMany({
          where: heldPosition,
          data: movedPosition
        });
        await transactionClient.position.updateMany({
          where: heldPosition,
          data: movedPosition
        });
      });

      return true;
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return false;

      throw error;
    }
  }

  /**
   * The position and its transactions go in one serializable transaction, so a
   * transaction recorded concurrently cannot survive as an orphan that a later
   * position in the same instrument would inherit.
   */
  async delete(params: AssetRepository.DeleteParams) {
    const { instrumentId, portfolioId } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      await transactionClient.transaction.deleteMany({
        where: { instrumentId, portfolioId }
      });

      return transactionClient.position.deleteMany({
        where: { instrumentId, portfolioId }
      });
    });
  }
}

namespace AssetRepository {
  export type GetParams = Pick<Position, 'symbol' | 'portfolioId'>;
  export type GetAllParams = Pick<Position, 'portfolioId'> & {
    page?: number;
    limit?: number;
    sort?: (typeof SortOrderTypes)[keyof typeof SortOrderTypes];
  };
  export type AddParams = Pick<Position, 'instrumentId' | 'portfolioId'>;
  export type UpdateParams = Pick<Position, 'portfolioId'> &
    Record<'oldInstrumentId' | 'newInstrumentId', string>;
  export type DeleteParams = Pick<Position, 'instrumentId' | 'portfolioId'>;
}
