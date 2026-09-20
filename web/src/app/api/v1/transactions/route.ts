import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetTransactionsResponseData } from './types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetTransactionsResponseData>({
    method: 'get',
    path: '/v1/transactions',
    searchParams: req.nextUrl.searchParams
  });
