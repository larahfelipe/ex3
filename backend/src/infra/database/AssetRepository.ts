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

  async getAll() {
    const assets = await this.prismaClient.asset.findMany();

    return assets;
  }

  async getAllByPortfolioId(portfolioId: string) {
    const assets = await this.prismaClient.asset.findMany({
      where: {
        portfolioId
      }
    });

    return assets;
  }

  async getById(id: string) {
    const asset = await this.prismaClient.asset.findUnique({
      where: {
        id
      }
    });

    return asset;
  }

  async getBySymbol(params: AssetRepository.GetParams) {
    const { symbol, portfolioId } = params;

    const asset = await this.prismaClient.asset.findFirst({
      where: {
        portfolioId,
        symbol
      }
    });

    return asset;
  }

  async add(params: AssetRepository.AddParams) {
    const { symbol, portfolioId } = params;

    const newAsset = await this.prismaClient.asset.create({
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

    return newAsset;
  }

  async update(params: AssetRepository.UpdateParams) {
    const { oldSymbol, newSymbol, portfolioId } = params;

    const updatedAsset = await this.prismaClient.asset.updateMany({
      where: {
        symbol: oldSymbol,
        portfolioId
      },
      data: {
        symbol: newSymbol
      }
    });

    return updatedAsset.count;
  }

  async updatePosition(params: AssetRepository.UpdatePositionParams) {
    const { id, operation, amount, balance } = params;

    const updatedAsset = await this.prismaClient.asset.update({
      where: {
        id
      },
      data: {
        amount: {
          [operation]: amount
        },
        balance: {
          [operation]: balance
        }
      }
    });

    return updatedAsset;
  }

  async delete(params: AssetRepository.DeleteParams) {
    const { symbol, portfolioId } = params;

    const deletedAsset = await this.prismaClient.asset.deleteMany({
      where: {
        symbol,
        portfolioId
      }
    });

    return deletedAsset.count;
  }
}

namespace AssetRepository {
  export type GetParams = Pick<Asset, 'symbol' | 'portfolioId'>;
  export type AddParams = Pick<Asset, 'symbol' | 'portfolioId'>;
  export type UpdateParams = Pick<Asset, 'portfolioId'> & {
    oldSymbol: string;
    newSymbol: string;
  };
  export type UpdatePositionParams = Pick<
    Asset,
    'id' | 'amount' | 'balance'
  > & {
    operation: 'increment' | 'decrement';
  };
  export type DeleteParams = Pick<Asset, 'symbol' | 'portfolioId'>;
}
