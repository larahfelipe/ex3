import { NextResponse, type NextRequest } from 'next/server';

import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import {
  botChallengeHeadersOf,
  clientAddressHeaders,
  jsonPayload
} from '@/lib/api-proxy';
import api from '@/lib/axios';
import { setSessionCookies } from '@/lib/session';

import type { SignInRequestPayload, SignInResponseData, User } from './types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = await jsonPayload<SignInRequestPayload>(req);

    const { data, status, statusText } = await api
      .getInstance()
      .post<User>('/v1/user', payload, {
        headers: {
          ...(await clientAddressHeaders()),
          ...botChallengeHeadersOf(req)
        }
      });

    const { accessToken, ...user } = data;

    if (accessToken) await setSessionCookies(accessToken);

    const res: SignInResponseData = user;

    return NextResponse.json<SignInResponseData>(res, { status, statusText });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
