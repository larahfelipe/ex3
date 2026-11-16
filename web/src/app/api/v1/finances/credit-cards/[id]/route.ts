import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  DeleteCreditCardResponseData,
  UpdateCreditCardResponseData
} from '../../types';

type CreditCardRouteContext = Record<'params', Promise<Record<'id', string>>>;

export const PATCH = async (
  req: NextRequest,
  { params }: CreditCardRouteContext
) => {
  const { id } = await params;

  return forwardToApi<UpdateCreditCardResponseData>({
    method: 'patch',
    path: `/v1/finances/credit-cards/${encodeURIComponent(id)}`,
    payloadFrom: req
  });
};

export const DELETE = async (
  _req: NextRequest,
  { params }: CreditCardRouteContext
) => {
  const { id } = await params;

  return forwardToApi<DeleteCreditCardResponseData>({
    method: 'delete',
    path: `/v1/finances/credit-cards/${encodeURIComponent(id)}`
  });
};
