import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfoliosResponseData } from './types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfoliosResponseData>({
    method: 'get',
    path: '/v1/portfolios',
    searchParams: req.nextUrl.searchParams
  });
