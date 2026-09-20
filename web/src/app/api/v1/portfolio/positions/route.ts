import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfolioPositionsResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfolioPositionsResponseData>({
    method: 'get',
    path: '/v1/portfolio/positions',
    searchParams: req.nextUrl.searchParams
  });
