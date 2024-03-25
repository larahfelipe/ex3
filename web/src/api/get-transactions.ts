import { api } from '@/lib/axios';

export const getTransactions = async (assetId: string) =>
  await api.get(`/v1/transactions/${assetId}`);
