import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import api, { ApiProxyError } from '@/lib/axios';

import type {
  DeleteTransactionResponseData,
  UpdateTransactionRequestPayload,
  UpdateTransactionResponseData
} from '../types';

type TransactionRouteContext = Record<'params', Promise<Record<'id', string>>>;

const authorizationHeaders = async () => {
  const authToken = (await cookies()).get(APP_STORAGE_KEYS.Token);
  if (!authToken?.value)
    throw new ApiProxyError('Missing access token', {
      status: 401,
      statusText: 'Unauthorized'
    });

  return { Authorization: `Bearer ${authToken.value}` };
};

export const PATCH = async (
  req: NextRequest,
  { params }: TransactionRouteContext
) => {
  try {
    const payload = (await req.json()) as UpdateTransactionRequestPayload;
    const headers = await authorizationHeaders();
    const { id } = await params;

    const { data, status, statusText } = await api
      .getInstance()
      .patch<UpdateTransactionResponseData>(
        `/v1/transaction/${encodeURIComponent(id)}`,
        payload,
        { headers }
      );

    return NextResponse.json<UpdateTransactionResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};

export const DELETE = async (
  _req: NextRequest,
  { params }: TransactionRouteContext
) => {
  try {
    const headers = await authorizationHeaders();
    const { id } = await params;

    const { data, status, statusText } = await api
      .getInstance()
      .delete<DeleteTransactionResponseData>(
        `/v1/transaction/${encodeURIComponent(id)}`,
        { headers }
      );

    return NextResponse.json<DeleteTransactionResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
