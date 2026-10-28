import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetFinanceSummaryResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetFinanceSummaryResponseData>({
    method: 'get',
    path: '/v1/finances/summary',
    searchParams: req.nextUrl.searchParams
  });
