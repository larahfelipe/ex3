import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { GetInstrumentsResponseData } from './types';

export const GET = (req: NextRequest) =>
  forwardToApi<GetInstrumentsResponseData>({
    method: 'get',
    path: '/v1/instruments',
    searchParams: req.nextUrl.searchParams
  });
