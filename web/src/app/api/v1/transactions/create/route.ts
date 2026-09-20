import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreateTransactionResponseData } from '../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreateTransactionResponseData>({
    method: 'post',
    path: '/v1/transaction',
    payloadFrom: req
  });
