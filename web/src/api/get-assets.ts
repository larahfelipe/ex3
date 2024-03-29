import { api } from '@/lib/axios';
import type { Maybe, WithId } from '@/types';

type WithDominance = Record<'dominance', Maybe<string>>;

type AssetProperties = {
  symbol: string;
  amount: number;
  balance: number;
  portfolioId: string;
};

export interface Asset extends WithId, WithDominance, AssetProperties {}

export type GetAssetsParams = {
  sort?: 'asc' | 'desc';
};

type GetAssetsResponse = Pick<GetAssetsParams, 'sort'> & {
  assets: Array<Asset>;
};

export const getAssets = async (params: GetAssetsParams) =>
  await api.get<GetAssetsResponse>('/v1/assets', { params });
