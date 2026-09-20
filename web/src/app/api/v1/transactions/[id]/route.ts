import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  DeleteTransactionResponseData,
  UpdateTransactionResponseData
} from '../types';

type TransactionRouteContext = Record<'params', Promise<Record<'id', string>>>;

export const PATCH = async (
  req: NextRequest,
  { params }: TransactionRouteContext
) => {
  const { id } = await params;

  return forwardToApi<UpdateTransactionResponseData>({
    method: 'patch',
    path: `/v1/transaction/${encodeURIComponent(id)}`,
    payloadFrom: req
  });
};

export const DELETE = async (
  _req: NextRequest,
  { params }: TransactionRouteContext
) => {
  const { id } = await params;

  return forwardToApi<DeleteTransactionResponseData>({
    method: 'delete',
    path: `/v1/transaction/${encodeURIComponent(id)}`
  });
};
