import { NextResponse, type NextRequest } from 'next/server';

import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import {
  botChallengeHeadersOf,
  clientAddressHeaders,
  jsonPayload
} from '@/lib/api-proxy';
import api from '@/lib/axios';
import { setSessionCookies } from '@/lib/session';

import type {
  SignUpApiResponseData,
  SignUpRequestPayload,
  SignUpResponseData
} from './types';

export const POST = async (req: NextRequest) => {
  try {
    const payload = await jsonPayload<SignUpRequestPayload>(req);

    const { data, status, statusText } = await api
      .getInstance()
      .post<SignUpApiResponseData>('/v1/user/create', payload, {
        headers: {
          ...(await clientAddressHeaders()),
          ...botChallengeHeadersOf(req)
        }
      });

    const { accessToken, ...user } = data.user;

    if (accessToken) await setSessionCookies(accessToken);

    const res: SignUpResponseData = {
      user,
      message: data.message
    };

    return NextResponse.json<SignUpResponseData>(res, { status, statusText });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
