import { type NextRequest, NextResponse } from 'next/server';

import { toApiProxyErrorResponse } from '@/lib/api-error-response';
import { clientAddressHeaders, jsonPayload } from '@/lib/api-proxy';
import api from '@/lib/axios';
import { setSessionCookie } from '@/lib/session';

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
        headers: await clientAddressHeaders()
      });

    const { accessToken, ...user } = data.user;

    if (accessToken) await setSessionCookie(accessToken);

    const res: SignUpResponseData = {
      user,
      message: data.message
    };

    return NextResponse.json<SignUpResponseData>(res, { status, statusText });
  } catch (e) {
    return toApiProxyErrorResponse(e);
  }
};
