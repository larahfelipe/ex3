import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetFinanceReportResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetFinanceReportResponseData>({
    method: 'get',
    path: '/v1/finances/reports',
    searchParams: req.nextUrl.searchParams
  });
