import type { Pagination, WithId, WithMessage, WithTimestamps } from '@/types';

export type PortfolioProperties = {
  name: string;
  baseCurrency: string;
};

export type Portfolio = WithId & WithTimestamps & PortfolioProperties;

export type GetPortfoliosRequestParams = {
  page?: number;
  limit?: number;
};

export type GetPortfoliosResponseData = {
  portfolios: Array<Portfolio>;
  pagination: Pagination;
};

export type CreatePortfolioRequestPayload = PortfolioProperties;

export type CreatePortfolioResponseData = WithMessage &
  Record<'portfolio', Portfolio>;

export type UpdatePortfolioRequestPayload = Record<
  'portfolioId',
  Portfolio['id']
> &
  Partial<PortfolioProperties>;

export type UpdatePortfolioResponseData = WithMessage &
  Record<'portfolio', Portfolio>;

export type GetPortfolioResponseData = Portfolio;

export type DeletePortfolioResponseData = WithMessage;
