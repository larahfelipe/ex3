import type { Asset } from '@/domain/models';

export type CreateAssetResponse = {
  asset: Asset | null;
  message: string | null;
};

export type InputPayload = {
  symbol: string;
};
