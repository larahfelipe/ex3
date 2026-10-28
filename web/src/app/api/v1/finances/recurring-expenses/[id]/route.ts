import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  GetRecurringExpenseResponseData,
  RecurringExpenseChangeResponseData
} from '../../types';

type RecurringExpenseRouteContext = Record<
  'params',
  Promise<Record<'id', string>>
>;

export const GET = async (
  req: NextRequest,
  { params }: RecurringExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<GetRecurringExpenseResponseData>({
    method: 'get',
    path: `/v1/finances/recurring-expenses/${encodeURIComponent(id)}`,
    searchParams: req.nextUrl.searchParams
  });
};

export const PATCH = async (
  req: NextRequest,
  { params }: RecurringExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<RecurringExpenseChangeResponseData>({
    method: 'patch',
    path: `/v1/finances/recurring-expenses/${encodeURIComponent(id)}`,
    payloadFrom: req
  });
};

export const DELETE = async (
  _req: NextRequest,
  { params }: RecurringExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<RecurringExpenseChangeResponseData>({
    method: 'delete',
    path: `/v1/finances/recurring-expenses/${encodeURIComponent(id)}`
  });
};
