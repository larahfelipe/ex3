import type { DecimalString, WithId, WithMessage } from '@/types';

export type AssetProperties = {
  symbol: string;
  quantity: DecimalString;
  averageCost: DecimalString;
  investedValue: DecimalString;
  portfolioId: string;
};

export interface Asset extends WithId, AssetProperties {}

export type CreateAssetRequestPayload = Pick<
  AssetProperties,
  'symbol' | 'portfolioId'
>;

export interface CreateAssetResponseData extends WithMessage {
  asset: Asset;
}

export type DeleteAssetRequestPayload = Pick<Asset, 'symbol'>;

export type DeleteAssetResponseData = WithMessage;
