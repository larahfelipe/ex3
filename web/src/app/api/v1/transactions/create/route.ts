import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import api, { ApiProxyError } from '@/lib/axios';

import {
  type CreateTransactionRequestPayload,
  type CreateTransactionResponseData
} from '../types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as CreateTransactionRequestPayload;

    const authToken = (await cookies()).get(APP_STORAGE_KEYS.Token);
    if (!authToken?.value)
      throw new ApiProxyError('Missing access token', {
        status: 401,
        statusText: 'Unauthorized'
      });

    const headers = {
      Authorization: `Bearer ${authToken.value}`
    };

    const { data, status, statusText } = await api
      .getInstance()
      .post<CreateTransactionResponseData>('/v1/transaction', payload, {
        headers
      });

    return NextResponse.json<CreateTransactionResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
