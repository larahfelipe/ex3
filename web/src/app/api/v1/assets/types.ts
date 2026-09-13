import type {
  DecimalString,
  Maybe,
  Pagination,
  WithId,
  WithMessage
} from '@/types';

export type WithDominance = Record<'dominance', Maybe<string>>;

export type AssetProperties = {
  symbol: string;
  quantity: DecimalString;
  averageCost: DecimalString;
  balance: DecimalString;
  portfolioId: string;
};

export interface Asset extends WithId, WithDominance, AssetProperties {}

export type GetAssetRequestParams = {
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
};

export type GetAssetResponseData = {
  assets: Array<Asset>;
  pagination: Pagination;
  sort: {
    field: string;
    order: GetAssetRequestParams['sort'];
  };
};

export type GetAssetWithTotalBalanceResponseData = GetAssetResponseData &
  Record<'totalBalance', number>;

export type CreateAssetRequestPayload = Pick<
  AssetProperties,
  'symbol' | 'portfolioId'
>;

export interface CreateAssetResponseData extends WithMessage {
  asset: Asset;
}

export type DeleteAssetRequestPayload = Pick<Asset, 'symbol'>;

export type DeleteAssetResponseData = WithMessage;
