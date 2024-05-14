import type { SortOrderTypes } from '@/config';
import type { Asset } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

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
        where: { portfolioId },
        take: limit !== 0 ? limitPerPage : undefined,
        skip: (page - 1) * limitPerPage || 0,
        ...(sort && { orderBy: { balance: sort } })
      })
    ]);

    const totalPages = Math.ceil(total / limitPerPage);

    return {
      docs,
      pagination: {
        page,
        total,
        limit: limitPerPage,
        totalPages: totalPages !== Infinity ? totalPages : 1
      }
    };
  }

  async getById(id: string) {
    return this.prismaClient.asset.findUnique({
      where: { id }
    });
  }

  async getBySymbol(params: AssetRepository.GetParams) {
    const { symbol, portfolioId } = params;

    return this.prismaClient.asset.findUnique({
      where: {
        portfolioId,
        symbol
      }
    });
  }

  async add(params: AssetRepository.AddParams) {
    const { symbol, portfolioId } = params;

    return this.prismaClient.asset.create({
      data: {
        symbol,
        transactions: {
          create: []
        },
        portfolio: {
          connect: {
            id: portfolioId
          }
        }
      }
    });
  }

  async update(params: AssetRepository.UpdateParams) {
    const { oldSymbol, newSymbol, portfolioId } = params;

    return this.prismaClient.asset.updateMany({
      where: {
        symbol: oldSymbol,
        portfolioId
      },
      data: {
        symbol: newSymbol
      }
    });
  }

  async updatePosition(params: AssetRepository.UpdatePositionParams) {
    const { symbol, operation, amount, balance } = params;

    return this.prismaClient.asset.update({
      where: { symbol },
      data: {
        amount: {
          [operation]: amount
        },
        balance: {
          [operation]: balance
        }
      }
    });
  }

  async delete(params: AssetRepository.DeleteParams) {
    const { symbol, portfolioId } = params;

    return this.prismaClient.asset.deleteMany({
      where: {
        symbol,
        portfolioId
      }
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
  export type AddParams = Pick<Asset, 'symbol' | 'portfolioId'>;
  export type UpdateParams = Pick<Asset, 'portfolioId'> & {
    oldSymbol: string;
    newSymbol: string;
  };
  export type UpdatePositionParams = Pick<
    Asset,
    'symbol' | 'amount' | 'balance'
  > & {
    operation: 'increment' | 'decrement';
  };
  export type DeleteParams = Pick<Asset, 'symbol' | 'portfolioId'>;
}
