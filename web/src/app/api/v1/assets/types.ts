import type { ListingReference } from '@/app/api/v1/instruments';
import type { DecimalString, WithId, WithMessage } from '@/types';

export type AssetProperties = {
  symbol: string;
  quantity: DecimalString;
  averageCost: DecimalString;
  investedValue: DecimalString;
  portfolioId: string;
};

export type Asset = WithId & AssetProperties;

export type CreateAssetRequestPayload = Pick<
  AssetProperties,
  'symbol' | 'portfolioId'
> & {
  listing?: ListingReference;
};

export type CreateAssetResponseData = WithMessage & Record<'asset', Asset>;

export type DeleteAssetRequestPayload = Pick<Asset, 'symbol'>;

export type DeleteAssetResponseData = WithMessage;
