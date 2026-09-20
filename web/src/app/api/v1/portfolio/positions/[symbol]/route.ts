import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfolioPositionResponseData } from '../../types';

type PositionRouteContext = Record<'params', Promise<Record<'symbol', string>>>;

export const GET = async (
  req: NextRequest,
  { params }: PositionRouteContext
) => {
  const { symbol } = await params;

  return forwardToApi<GetPortfolioPositionResponseData>({
    method: 'get',
    path: `/v1/portfolio/positions/${encodeURIComponent(symbol)}`,
    searchParams: req.nextUrl.searchParams
  });
};
