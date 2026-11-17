import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetFinanceNotificationsResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetFinanceNotificationsResponseData>({
    method: 'get',
    path: '/v1/finances/notifications',
    searchParams: req.nextUrl.searchParams
  });
