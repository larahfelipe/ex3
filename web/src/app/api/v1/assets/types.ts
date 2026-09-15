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
  investedValue: DecimalString;
  portfolioId: string;
};

export interface Asset extends WithId, WithDominance, AssetProperties {}

export type TransactionCount = Record<'buy' | 'sell', number>;

export type ListedAsset = Asset & Record<'transactionCount', TransactionCount>;

export type GetAssetRequestParams = {
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
};

export type GetAssetResponseData = {
  assets: Array<ListedAsset>;
  pagination: Pagination;
  sort: {
    field: string;
    order: GetAssetRequestParams['sort'];
  };
};

export type GetAssetWithTotalInvestedValueResponseData = GetAssetResponseData &
  Record<'totalInvestedValue', number>;

export type Quote = {
  price: DecimalString;
  currency: string;
  timestamp: string;
  source: string;
  previousClose?: DecimalString;
};

export type AssetValuation = Pick<AssetProperties, 'symbol'> &
  (
    | {
        outcome: 'valued';
        quote: Quote;
        marketValue: DecimalString;
        profitLoss?: DecimalString;
        profitLossPercent?: DecimalString;
      }
    | { outcome: 'not-found' | 'unavailable' }
  );

export type GetAssetValuationsRequestParams = Pick<
  AssetProperties,
  'portfolioId'
> &
  Record<'symbols', string>;

export type GetAssetValuationsResponseData = {
  valuations: Array<AssetValuation>;
};

export type CreateAssetRequestPayload = Pick<
  AssetProperties,
  'symbol' | 'portfolioId'
>;

export interface CreateAssetResponseData extends WithMessage {
  asset: Asset;
}

export type DeleteAssetRequestPayload = Pick<Asset, 'symbol'>;

export type DeleteAssetResponseData = WithMessage;
