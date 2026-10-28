import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetInstallmentPlansResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetInstallmentPlansResponseData>({
    method: 'get',
    path: '/v1/finances/installment-plans',
    searchParams: req.nextUrl.searchParams
  });
