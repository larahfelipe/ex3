import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetRecurringExpensesResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetRecurringExpensesResponseData>({
    method: 'get',
    path: '/v1/finances/recurring-expenses',
    searchParams: req.nextUrl.searchParams
  });
