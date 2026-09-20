import { PortfolioMessages } from '@/config';
import type { Portfolio } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { PortfolioRepository } from '@/infra/database';

export type PortfolioScope = Record<'userId' | 'portfolioId', string>;

/**
 * The single ownership check of the API: a portfolio of another user answers
 * as one that does not exist, so a caller cannot probe for foreign ids.
 */
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
