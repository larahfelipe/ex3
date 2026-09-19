import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import api, { ApiProxyError } from '@/lib/axios';

import type { GetPortfolioPositionResponseData } from '../../types';

type PositionRouteContext = Record<'params', Promise<Record<'symbol', string>>>;

export const GET = async (
  req: NextRequest,
  { params }: PositionRouteContext
) => {
  try {
    const authToken = (await cookies()).get(APP_STORAGE_KEYS.Token);
    if (!authToken?.value)
      throw new ApiProxyError('Missing access token', {
        status: 401,
        statusText: 'Unauthorized'
      });

    const { symbol } = await params;
    const headers = {
      Authorization: `Bearer ${authToken.value}`
    };

    const { data, status, statusText } = await api
      .getInstance()
      .get<GetPortfolioPositionResponseData>(
        `/v1/portfolio/positions/${encodeURIComponent(symbol)}`,
        {
          headers,
          params: req.nextUrl.searchParams
        }
      );

    return NextResponse.json<GetPortfolioPositionResponseData>(data, {
      status,
      statusText
    });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
