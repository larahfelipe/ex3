import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreateExpenseResponseData } from '../../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreateExpenseResponseData>({
    method: 'post',
    path: '/v1/finances/expenses',
    payloadFrom: req
  });
