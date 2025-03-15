import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api, { ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';

import type { DeleteAssetResponseData } from '../types';

export const DELETE = async (req: NextRequest) => {
  try {
    const assetSymbol = req.nextUrl.pathname.split('/').at(-1);
    if (!assetSymbol)
      throw new ApiProxyError('Missing asset symbol', {
        status: 400,
        statusText: 'Bad Request'
      });

    const authToken = cookies().get(APP_STORAGE_KEYS.Token);
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
      .delete<DeleteAssetResponseData>(`/v1/asset/${assetSymbol}`, { headers });

    return NextResponse.json<DeleteAssetResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
