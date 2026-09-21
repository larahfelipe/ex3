import type { Portfolio } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

const DEFAULT_PAGE_LIMIT = 10;

/**
 * Every lookup is filtered by the owner, so a portfolio id taken from a request
 * never reaches another user's portfolio.
 */
export class PortfolioRepository {
  private static INSTANCE: PortfolioRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!PortfolioRepository.INSTANCE)
      PortfolioRepository.INSTANCE = new PortfolioRepository();

    return PortfolioRepository.INSTANCE;
  }

  async getAll(params: PortfolioRepository.GetAllParams) {
    const { userId, page = 1, limit = DEFAULT_PAGE_LIMIT } = params;

    const [total, docs] = await Promise.all([
      this.prismaClient.portfolio.count({ where: { userId } }),
      this.prismaClient.portfolio.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
        skip: (page - 1) * limit
      })
    ]);

    return {
      docs,
      pagination: { page, total, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(params: PortfolioRepository.GetByIdParams) {
    const { id, userId } = params;

    return this.prismaClient.portfolio.findFirst({ where: { id, userId } });
  }

  async add(params: PortfolioRepository.AddParams) {
    return this.prismaClient.portfolio.create({ data: params });
  }

  async update(
    params: PortfolioRepository.UpdateParams
  ): Promise<PortfolioRepository.UpdateOutcome> {
    const { id, userId, name, baseCurrency } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      const portfolio = await transactionClient.portfolio.findFirst({
        where: { id, userId }
      });

      if (!portfolio) return { outcome: 'not-found' };

      const changesBaseCurrency =
        baseCurrency !== undefined && baseCurrency !== portfolio.baseCurrency;

      if (
        changesBaseCurrency &&
        (await transactionClient.transaction.count({
          where: { portfolioId: id }
        })) > 0
      )
        return { outcome: 'base-currency-locked' };

      return {
        outcome: 'updated',
        portfolio: await transactionClient.portfolio.update({
          where: { id },
          data: { name, baseCurrency }
        })
      };
    });
  }

  async delete(
    params: PortfolioRepository.DeleteParams
  ): Promise<PortfolioRepository.DeleteOutcome> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      const portfolio = await transactionClient.portfolio.findFirst({
        where: { id, userId }
      });

      if (!portfolio) return { outcome: 'not-found' };

      const ownedPortfolios = await transactionClient.portfolio.count({
        where: { userId }
      });

      if (ownedPortfolios === 1) return { outcome: 'last-portfolio' };

      await transactionClient.transaction.deleteMany({
        where: { portfolioId: id }
      });
      await transactionClient.position.deleteMany({
        where: { portfolioId: id }
      });
      await transactionClient.portfolio.delete({ where: { id } });

      return { outcome: 'deleted' };
    });
  }
}

namespace PortfolioRepository {
  export type GetAllParams = Pick<Portfolio, 'userId'> & {
    page?: number;
    limit?: number;
  };
  export type GetByIdParams = Pick<Portfolio, 'id' | 'userId'>;
  export type AddParams = Pick<Portfolio, 'userId' | 'name' | 'baseCurrency'>;
  export type UpdateParams = GetByIdParams &
    Partial<Pick<Portfolio, 'name' | 'baseCurrency'>>;
  export type UpdateOutcome =
    | { outcome: 'updated'; portfolio: Omit<Portfolio, 'positions'> }
    | { outcome: 'not-found' }
    | { outcome: 'base-currency-locked' };
  export type DeleteParams = GetByIdParams;
  export type DeleteOutcome =
    | { outcome: 'deleted' }
    | { outcome: 'not-found' }
    | { outcome: 'last-portfolio' };
}
