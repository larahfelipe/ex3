import { api } from '@/lib/axios';
import type { Maybe, Pagination, WithId } from '@/types';

type WithDominance = Record<'dominance', Maybe<string>>;

export type AssetProperties = {
  symbol: string;
  amount: number;
  balance: number;
  portfolioId: string;
};

export interface Asset extends WithId, WithDominance, AssetProperties {}

export type GetAssetsParams = {
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
};

type GetAssetsResponse = {
  assets: Array<Asset>;
  pagination: Pagination;
  sort: {
    field: string;
    order: GetAssetsParams['sort'];
  };
};

export const getAssets = async (params: GetAssetsParams) =>
  await api.get<GetAssetsResponse>('/v1/assets', { params });
