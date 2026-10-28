import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { InstallmentPlanChangeResponseData } from '../../../types';

type InstallmentPlanRouteContext = Record<
  'params',
  Promise<Record<'id', string>>
>;

export const POST = async (
  req: NextRequest,
  { params }: InstallmentPlanRouteContext
) => {
  const { id } = await params;

  return forwardToApi<InstallmentPlanChangeResponseData>({
    method: 'post',
    path: `/v1/finances/installment-plans/${encodeURIComponent(id)}/reschedule`,
    payloadFrom: req
  });
};
