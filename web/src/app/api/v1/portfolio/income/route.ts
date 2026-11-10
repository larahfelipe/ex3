import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPortfolioIncomeResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfolioIncomeResponseData>({
    method: 'get',
    path: '/v1/portfolio/income',
    searchParams: req.nextUrl.searchParams
  });
