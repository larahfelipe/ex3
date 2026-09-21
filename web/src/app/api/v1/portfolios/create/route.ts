import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreatePortfolioResponseData } from '../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreatePortfolioResponseData>({
    method: 'post',
    path: '/v1/portfolio',
    payloadFrom: req
  });
