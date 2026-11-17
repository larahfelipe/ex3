import type { NextRequest } from 'next/server';

import { forwardToApi, jsonPayload } from '@/lib/api-proxy';
import { clearSessionCookies } from '@/lib/session';

import type {
  GetCurrentUserResponseData,
  UpdateCurrentUserResponseData
} from './types';

export const GET = () =>
  forwardToApi<GetCurrentUserResponseData>({
    method: 'get',
    path: '/v1/user'
  });

export const PATCH = async (req: NextRequest) => {
  const res = await forwardToApi<UpdateCurrentUserResponseData>({
    method: 'patch',
    path: '/v1/user',
    payloadFrom: req.clone()
  });

  if (res.ok) {
    const payload = await jsonPayload(req);
    const hasChangedPassword =
      typeof payload === 'object' &&
      payload !== null &&
      'newPassword' in payload;

    if (hasChangedPassword) await clearSessionCookies();
  }

  return res;
};
