import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetFinanceCalendarResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetFinanceCalendarResponseData>({
    method: 'get',
    path: '/v1/finances/calendar',
    searchParams: req.nextUrl.searchParams
  });
