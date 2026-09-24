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

/**
 * The API accepts `newPassword` only with the correct `oldPassword`, and a
 * password change revokes the session that made it, so the cookie holding the
 * revoked token is cleared in the same response, along with the marker, since
 * the user ended this session.
 */
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
