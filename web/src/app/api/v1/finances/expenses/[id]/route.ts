import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  GetExpenseResponseData,
  UpdateExpenseResponseData,
  DeleteExpenseResponseData
} from '../../types';

type ExpenseRouteContext = Record<'params', Promise<Record<'id', string>>>;

export const GET = async (
  req: NextRequest,
  { params }: ExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<GetExpenseResponseData>({
    method: 'get',
    path: `/v1/finances/expenses/${encodeURIComponent(id)}`,
    searchParams: req.nextUrl.searchParams
  });
};

export const PATCH = async (
  req: NextRequest,
  { params }: ExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<UpdateExpenseResponseData>({
    method: 'patch',
    path: `/v1/finances/expenses/${encodeURIComponent(id)}`,
    payloadFrom: req
  });
};

export const DELETE = async (
  _req: NextRequest,
  { params }: ExpenseRouteContext
) => {
  const { id } = await params;

  return forwardToApi<DeleteExpenseResponseData>({
    method: 'delete',
    path: `/v1/finances/expenses/${encodeURIComponent(id)}`
  });
};
