import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { CreateInstallmentPlanResponseData } from '../../types';

export const POST = (req: NextRequest) =>
  forwardToApi<CreateInstallmentPlanResponseData>({
    method: 'post',
    path: '/v1/finances/installment-plans',
    payloadFrom: req
  });
