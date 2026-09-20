import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { DeleteAssetResponseData } from '../types';

type AssetRouteContext = Record<'params', Promise<Record<'symbol', string>>>;

export const DELETE = async (
  req: NextRequest,
  { params }: AssetRouteContext
) => {
  const { symbol } = await params;

  return forwardToApi<DeleteAssetResponseData>({
    method: 'delete',
    path: `/v1/asset/${encodeURIComponent(symbol)}`,
    searchParams: req.nextUrl.searchParams
  });
};
