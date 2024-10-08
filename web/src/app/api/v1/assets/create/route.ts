import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api, { type ApiError, type ApiErrorData } from '@/lib/axios';

import type {
  CreateAssetRequestPayload,
  CreateAssetResponseData
} from '../types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = (await req.json()) as CreateAssetRequestPayload;

    const authToken = cookies().get(APP_STORAGE_KEYS.Token);
    if (!authToken?.value) throw new Error('Missing access token');

    const headers = {
      Authorization: `Bearer ${authToken.value}`
    };

    const { data, status, statusText } =
      await api.server.post<CreateAssetResponseData>('/v1/asset', payload, {
        headers
      });

    return NextResponse.json<CreateAssetResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiError;

    return NextResponse.json<ApiErrorData>(error, { status, statusText });
  }
};
