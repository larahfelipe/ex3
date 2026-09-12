import { z } from 'zod';

export const PortfolioScopeSchema = z.object({
  portfolioId: z.uuid('Portfolio id must be a UUID')
});
