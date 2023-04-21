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
    const assets = await this.prismaClient.asset.findMany({
      include: {
        transactions: true
      }
    });

    return assets;
  }

  async getBySymbol(params: AssetRepository.GetParams) {
    const { symbol, portfolioId } = params;

    const asset = await this.prismaClient.asset.findFirst({
      where: {
        portfolioId,
        symbol
      },
      include: {
        transactions: true
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
      },
      include: {
        transactions: true
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
  export type GetParams = {
    symbol: string;
    portfolioId: string;
  };
  export type AddParams = {
    symbol: string;
    portfolioId: string;
  };
  export type UpdateParams = {
    oldSymbol: string;
    newSymbol: string;
    portfolioId: string;
  };
  export type DeleteParams = {
    symbol: string;
    portfolioId: string;
  };
}
