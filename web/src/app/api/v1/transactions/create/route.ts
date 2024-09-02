import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { EX3_STORAGE_KEYS } from '@/common/constants';
import api, { type ApiError, type ApiErrorData } from '@/lib/axios';

import {
  type CreateTransactionRequestPayload,
  type CreateTransactionResponseData
} from '../types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as CreateTransactionRequestPayload;

    const authToken = cookies().get(EX3_STORAGE_KEYS.Token);
    if (!authToken?.value) throw new Error('Missing access token');

    const headers = {
      Authorization: `Bearer ${authToken.value}`
    };

    const { data, status, statusText } =
      await api.server.post<CreateTransactionResponseData>(
        '/v1/transaction',
        payload,
        { headers }
      );

    return NextResponse.json<CreateTransactionResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiError;

    return NextResponse.json<ApiErrorData>(error, { status, statusText });
  }
};
