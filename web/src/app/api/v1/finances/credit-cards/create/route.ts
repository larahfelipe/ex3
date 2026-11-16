import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreateCreditCardResponseData } from '../../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreateCreditCardResponseData>({
    method: 'post',
    path: '/v1/finances/credit-cards',
    payloadFrom: req
  });
