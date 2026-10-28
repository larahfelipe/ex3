import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfolioPerformanceResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfolioPerformanceResponseData>({
    method: 'get',
    path: '/v1/portfolio/performance',
    searchParams: req.nextUrl.searchParams
  });
