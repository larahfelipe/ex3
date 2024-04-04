import { api } from '@/lib/axios';
import type { WithMessage } from '@/types';

import type { Asset } from './get-assets';

export type DeleteAssetPayload = Pick<Asset, 'symbol'>;

export interface DeleteAssetResponse extends WithMessage {}

export const deleteAsset = async (payload: DeleteAssetPayload) =>
  await api.delete<DeleteAssetResponse>(`/v1/asset/${payload.symbol}`);
