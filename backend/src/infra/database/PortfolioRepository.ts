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
}

namespace PortfolioRepository {
  export type GetAllParams = Pick<Portfolio, 'userId'> & {
    page?: number;
    limit?: number;
  };
  export type GetByIdParams = Pick<Portfolio, 'id' | 'userId'>;
  export type AddParams = Pick<Portfolio, 'userId' | 'name' | 'baseCurrency'>;
}
