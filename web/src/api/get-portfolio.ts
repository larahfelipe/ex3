import { api } from '@/lib/axios';

type GetPortfolioResponse = Record<'portfolioId' | 'userId', string>;

export const getPortfolio = async () =>
  await api.get<GetPortfolioResponse>('/v1/portfolio');
