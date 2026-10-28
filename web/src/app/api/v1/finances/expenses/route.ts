import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetExpensesResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetExpensesResponseData>({
    method: 'get',
    path: '/v1/finances/expenses',
    searchParams: req.nextUrl.searchParams
  });
