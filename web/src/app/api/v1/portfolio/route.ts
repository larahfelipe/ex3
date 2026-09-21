import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  DeletePortfolioResponseData,
  GetPortfolioResponseData,
  UpdatePortfolioResponseData
} from '../portfolios';

export const GET = (req: NextRequest) =>
  forwardToApi<GetPortfolioResponseData>({
    method: 'get',
    path: '/v1/portfolio',
    searchParams: req.nextUrl.searchParams
  });

export const PATCH = (req: NextRequest) =>
  forwardToApi<UpdatePortfolioResponseData>({
    method: 'patch',
    path: '/v1/portfolio',
    payloadFrom: req
  });

export const DELETE = (req: NextRequest) =>
  forwardToApi<DeletePortfolioResponseData>({
    method: 'delete',
    path: '/v1/portfolio',
    searchParams: req.nextUrl.searchParams
  });
