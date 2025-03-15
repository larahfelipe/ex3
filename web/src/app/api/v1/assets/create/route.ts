import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api, { ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';

import type {
  CreateAssetRequestPayload,
  CreateAssetResponseData
} from '../types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as CreateAssetRequestPayload;

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
      .post<CreateAssetResponseData>('/v1/asset', payload, {
        headers
      });

    return NextResponse.json<CreateAssetResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
