import type { Pagination, WithId, WithTimestamps } from '@/types';

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
