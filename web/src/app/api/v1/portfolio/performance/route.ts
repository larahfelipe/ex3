import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import api, { ApiProxyError } from '@/lib/axios';

import type { GetPortfolioPerformanceResponseData } from '../types';

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
      .get<GetPortfolioPerformanceResponseData>('/v1/portfolio/performance', {
        headers,
        params: req.nextUrl.searchParams
      });

    return NextResponse.json<GetPortfolioPerformanceResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
