import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetTransactionImportsResponseData } from './types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetTransactionImportsResponseData>({
    method: 'get',
    path: '/v1/transaction-imports',
    searchParams: req.nextUrl.searchParams
  });
