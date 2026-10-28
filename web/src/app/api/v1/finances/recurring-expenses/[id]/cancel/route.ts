import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { RecurringExpenseChangeResponseData } from '../../../types';

type RecurringExpenseRouteContext = Record<
  'params',
  Promise<Record<'id', string>>
>;

export const POST = async (
  req: NextRequest,
  { params }: RecurringExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<RecurringExpenseChangeResponseData>({
    method: 'post',
    path: `/v1/finances/recurring-expenses/${encodeURIComponent(id)}/cancel`,
    payloadFrom: req
  });
};
