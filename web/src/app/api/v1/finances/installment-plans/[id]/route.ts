import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  GetInstallmentPlanResponseData,
  InstallmentPlanChangeResponseData
} from '../../types';

type InstallmentPlanRouteContext = Record<
  'params',
  Promise<Record<'id', string>>
>;

export const GET = async (
  req: NextRequest,
  { params }: InstallmentPlanRouteContext
) => {
  const { id } = await params;

  return forwardToApi<GetInstallmentPlanResponseData>({
    method: 'get',
    path: `/v1/finances/installment-plans/${encodeURIComponent(id)}`,
    searchParams: req.nextUrl.searchParams
  });
};

export const PATCH = async (
  req: NextRequest,
  { params }: InstallmentPlanRouteContext
) => {
  const { id } = await params;

  return forwardToApi<InstallmentPlanChangeResponseData>({
    method: 'patch',
    path: `/v1/finances/installment-plans/${encodeURIComponent(id)}`,
    payloadFrom: req
  });
};

export const DELETE = async (
  _req: NextRequest,
  { params }: InstallmentPlanRouteContext
) => {
  const { id } = await params;

  return forwardToApi<InstallmentPlanChangeResponseData>({
    method: 'delete',
    path: `/v1/finances/installment-plans/${encodeURIComponent(id)}`
  });
};
