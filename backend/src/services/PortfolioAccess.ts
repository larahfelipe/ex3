import { PortfolioMessages } from '@/config';
import type { Portfolio } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { PortfolioRepository } from '@/infra/database';

export type PortfolioScope = Record<'userId' | 'portfolioId', string>;

export const requireOwnedPortfolio = async (
  portfolioRepository: PortfolioRepository,
  { userId, portfolioId }: PortfolioScope
): Promise<Omit<Portfolio, 'positions'>> => {
  const portfolio = await portfolioRepository.getById({
    id: portfolioId,
    userId
  });

  if (!portfolio) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

  return portfolio;
};
