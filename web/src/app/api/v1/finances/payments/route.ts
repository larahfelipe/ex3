import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetPaymentsResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPaymentsResponseData>({
    method: 'get',
    path: '/v1/finances/payments',
    searchParams: req.nextUrl.searchParams
  });
