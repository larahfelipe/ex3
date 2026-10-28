import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  UpdatePaymentResponseData,
  VoidPaymentResponseData
} from '../../../../types';

type PaymentRouteContext = Record<
  'params',
  Promise<Record<'id' | 'paymentId', string>>
>;

const paymentPath = ({ id, paymentId }: Record<'id' | 'paymentId', string>) =>
  `/v1/finances/expenses/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`;

export const PATCH = async (
  req: NextRequest,
  { params }: PaymentRouteContext
) =>
  forwardToApi<UpdatePaymentResponseData>({
    method: 'patch',
    path: paymentPath(await params),
    payloadFrom: req
  });

export const DELETE = async (
  _req: NextRequest,
  { params }: PaymentRouteContext
) =>
  forwardToApi<VoidPaymentResponseData>({
    method: 'delete',
    path: paymentPath(await params)
  });
