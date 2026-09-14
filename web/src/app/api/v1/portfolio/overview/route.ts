import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import api, { ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';

import type { GetPortfolioOverviewResponseData } from '../types';

export const GET = async (req: NextRequest) => {
  try {
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
      .get<GetPortfolioOverviewResponseData>('/v1/portfolio/overview', {
        headers,
        params: req.nextUrl.searchParams
      });

    return NextResponse.json<GetPortfolioOverviewResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
