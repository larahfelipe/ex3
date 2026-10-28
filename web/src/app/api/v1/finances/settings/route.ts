import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type {
  GetFinanceSettingsResponseData,
  UpdateFinanceSettingsResponseData
} from '../types';

export const GET = () =>
  forwardToApi<GetFinanceSettingsResponseData>({
    method: 'get',
    path: '/v1/finances/settings'
  });

export const PUT = (req: NextRequest) =>
  forwardToApi<UpdateFinanceSettingsResponseData>({
    method: 'put',
    path: '/v1/finances/settings',
    payloadFrom: req
  });
