import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { RecordPaymentResponseData } from '../../../../types';

type ExpenseRouteContext = Record<'params', Promise<Record<'id', string>>>;

export const POST = async (
  req: NextRequest,
  { params }: ExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<RecordPaymentResponseData>({
    method: 'post',
    path: `/v1/finances/expenses/${encodeURIComponent(id)}/payments`,
    payloadFrom: req
  });
};
