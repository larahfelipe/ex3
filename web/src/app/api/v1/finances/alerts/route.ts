import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetFinanceAlertsResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetFinanceAlertsResponseData>({
    method: 'get',
    path: '/v1/finances/alerts',
    searchParams: req.nextUrl.searchParams
  });
