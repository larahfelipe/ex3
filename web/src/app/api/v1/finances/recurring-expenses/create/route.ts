import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreateRecurringExpenseResponseData } from '../../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreateRecurringExpenseResponseData>({
    method: 'post',
    path: '/v1/finances/recurring-expenses',
    payloadFrom: req
  });
