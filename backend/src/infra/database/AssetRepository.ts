import type { SortOrderTypes } from '@/config';
import type { Asset } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

const INSTRUMENT_SYMBOL = { instrument: { select: { symbol: true } } } as const;

const toAsset = ({
  instrument,
  ...position
}: Omit<Asset, 'symbol'> & Record<'instrument', Pick<Asset, 'symbol'>>) => ({
  ...position,
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
      this.prismaClient.asset.count({ where: { portfolioId } }),
      this.prismaClient.asset.findMany({
        ...(sort && { orderBy: { balance: sort } }),
        ...(limit !== 0 && { take: limitPerPage }),
        where: { portfolioId },
        include: INSTRUMENT_SYMBOL,
        skip: (page - 1) * limitPerPage || 0
      })
    ]);

    const totalPages = Math.ceil(total / limitPerPage);

    return {
      docs: docs.map(toAsset),
      pagination: {
        page,
        total,
        limit: limitPerPage,
        totalPages: totalPages !== Infinity ? totalPages : 1
      }
    };
  }

  async getById(id: string) {
    const asset = await this.prismaClient.asset.findUnique({
      where: { id },
      include: INSTRUMENT_SYMBOL
    });

    return asset && toAsset(asset);
  }

  async getBySymbol(params: AssetRepository.GetParams) {
    const { symbol, portfolioId } = params;

    const asset = await this.prismaClient.asset.findFirst({
      where: { portfolioId, instrument: { symbol } },
      include: INSTRUMENT_SYMBOL
    });

    return asset && toAsset(asset);
  }

  /**
   * The unique index on portfolio and instrument is the only authority on
   * whether the portfolio already holds the instrument, so of concurrent
   * additions exactly one succeeds and the others resolve to null.
   */
  async add(params: AssetRepository.AddParams) {
    try {
      const asset = await this.prismaClient.asset.create({
        data: params,
        include: INSTRUMENT_SYMBOL
      });

      return toAsset(asset);
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return null;

      throw error;
    }
  }

  /**
   * The asset and its transactions move to the new instrument in one
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
        await transactionClient.asset.updateMany({
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
   * The asset and its transactions go in one serializable transaction, so a
   * transaction recorded concurrently cannot survive as an orphan that a later
   * asset of the same instrument would inherit.
   */
  async delete(params: AssetRepository.DeleteParams) {
    const { instrumentId, portfolioId } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      await transactionClient.transaction.deleteMany({
        where: { instrumentId, portfolioId }
      });

      return transactionClient.asset.deleteMany({
        where: { instrumentId, portfolioId }
      });
    });
  }
}

namespace AssetRepository {
  export type GetParams = Pick<Asset, 'symbol' | 'portfolioId'>;
  export type GetAllParams = Pick<Asset, 'portfolioId'> & {
    page?: number;
    limit?: number;
    sort?: (typeof SortOrderTypes)[keyof typeof SortOrderTypes];
  };
  export type AddParams = Pick<Asset, 'instrumentId' | 'portfolioId'>;
  export type UpdateParams = Pick<Asset, 'portfolioId'> &
    Record<'oldInstrumentId' | 'newInstrumentId', string>;
  export type DeleteParams = Pick<Asset, 'instrumentId' | 'portfolioId'>;
}
