import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfolioAllocationResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfolioAllocationResponseData>({
    method: 'get',
    path: '/v1/portfolio/allocation',
    searchParams: req.nextUrl.searchParams
  });
