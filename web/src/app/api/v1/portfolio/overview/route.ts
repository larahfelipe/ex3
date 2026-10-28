import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfolioOverviewResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfolioOverviewResponseData>({
    method: 'get',
    path: '/v1/portfolio/overview',
    searchParams: req.nextUrl.searchParams
  });
