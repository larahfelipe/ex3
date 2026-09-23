import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPositionIndicatorsResponseData } from '../../../types';

type PositionIndicatorsRouteContext = Record<
  'params',
  Promise<Record<'symbol', string>>
>;

export const GET = async (
  req: NextRequest,
  { params }: PositionIndicatorsRouteContext
) => {
  const { symbol } = await params;

  return forwardToApi<GetPositionIndicatorsResponseData>({
    method: 'get',
    path: `/v1/portfolio/positions/${encodeURIComponent(symbol)}/indicators`,
    searchParams: req.nextUrl.searchParams
  });
};
