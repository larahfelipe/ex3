import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { SearchInstrumentsResponseData } from '../types';

export const GET = (req: NextRequest) =>
  forwardToApi<SearchInstrumentsResponseData>({
    method: 'get',
    path: '/v1/instruments/search',
    searchParams: req.nextUrl.searchParams
  });
