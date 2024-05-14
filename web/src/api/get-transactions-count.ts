import { api } from '@/lib/axios';
import type { Asset } from './get-assets';

export type GetTransactionCountPayload = Pick<Asset, 'symbol'>;

type GetTransactionsCountResponse = Record<'buy' | 'sell', number>;

export const getTransactionsCount = async (
  payload: GetTransactionCountPayload
) =>
  await api.get<GetTransactionsCountResponse>(
    `/v1/transactions/${payload.symbol}/count`
  );
