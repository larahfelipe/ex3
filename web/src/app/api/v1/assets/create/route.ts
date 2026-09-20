import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreateAssetResponseData } from '../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreateAssetResponseData>({
    method: 'post',
    path: '/v1/asset',
    payloadFrom: req
  });
