import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api, { type ApiError, type ApiErrorData } from '@/lib/axios';

import { type GetTransactionsResponseData } from '../types';

export const GET = async (req: NextRequest) => {
  try {
    const assetSymbol = req.nextUrl.pathname.split('/').at(-1);
    if (!assetSymbol) throw new Error('Missing asset symbol');

    const authToken = cookies().get(APP_STORAGE_KEYS.Token);
    if (!authToken?.value) throw new Error('Missing access token');

    const headers = {
      Authorization: `Bearer ${authToken.value}`
    };

    const { data, status, statusText } =
      await api.server.get<GetTransactionsResponseData>(
        `/v1/transactions/${assetSymbol}`,
        { headers }
      );

    return NextResponse.json<GetTransactionsResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiError;

    return NextResponse.json<ApiErrorData>(error, { status, statusText });
  }
};
