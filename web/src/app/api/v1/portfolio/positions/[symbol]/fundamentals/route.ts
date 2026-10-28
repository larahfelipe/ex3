import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPositionFundamentalsResponseData } from '../../../types';

type PositionFundamentalsRouteContext = Record<
  'params',
  Promise<Record<'symbol', string>>
>;

export const GET = async (
  req: NextRequest,
  { params }: PositionFundamentalsRouteContext
) => {
  const { symbol } = await params;

  return forwardToApi<GetPositionFundamentalsResponseData>({
    method: 'get',
    path: `/v1/portfolio/positions/${encodeURIComponent(symbol)}/fundamentals`,
    searchParams: req.nextUrl.searchParams
  });
};
