import type { Pagination, WithId, WithMessage, WithTimestamps } from '@/types';

export type PortfolioProperties = {
  name: string;
  baseCurrency: string;
};

export interface Portfolio
  extends WithId, WithTimestamps, PortfolioProperties {}

export type GetPortfoliosRequestParams = {
  page?: number;
  limit?: number;
};

export type GetPortfoliosResponseData = {
  portfolios: Array<Portfolio>;
  pagination: Pagination;
};

export type CreatePortfolioRequestPayload = PortfolioProperties;

export interface CreatePortfolioResponseData extends WithMessage {
  portfolio: Portfolio;
}

export type UpdatePortfolioRequestPayload = Record<
  'portfolioId',
  Portfolio['id']
> &
  Partial<PortfolioProperties>;

export interface UpdatePortfolioResponseData extends WithMessage {
  portfolio: Portfolio;
}

export type GetPortfolioResponseData = Portfolio;

export type DeletePortfolioResponseData = WithMessage;
