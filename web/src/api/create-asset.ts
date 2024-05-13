import { api } from '@/lib/axios';
import type { WithMessage } from '@/types';

import type { Asset, AssetProperties } from './get-assets';

export type CreateAssetPayload = Pick<AssetProperties, 'symbol'>;

export interface CreateAssetResponse extends WithMessage {
  asset: Asset;
}

export const createAsset = async (payload: CreateAssetPayload) =>
  await api.post<CreateAssetResponse>('/v1/asset', payload);
