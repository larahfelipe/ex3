import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import { formatNumber } from '@/common/utils';
import api, { ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';

import type {
  GetAssetRequestParams,
  GetAssetResponseData,
  GetAssetWithTotalBalanceResponseData
} from './types';

export const GET = async (
  _: NextRequest,
  { params }: Record<'params', GetAssetRequestParams>
) => {
  try {
    const authToken = cookies().get(APP_STORAGE_KEYS.Token);
    if (!authToken?.value)
      throw new ApiProxyError('Missing access token', {
        status: 401,
        statusText: 'Unauthorized'
      });

    const headers = {
      Authorization: `Bearer ${authToken.value}`
    };

    const { data, status, statusText } = await api
      .getInstance()
      .get<GetAssetResponseData>('/v1/assets', {
        headers,
        params
      });

    const totalBalance = data.assets.reduce((acc, curr) => {
      acc += curr.balance;
      return acc;
    }, 0);

    const res: GetAssetWithTotalBalanceResponseData = {
      totalBalance,
      sort: data.sort,
      pagination: data.pagination,
      assets: data.assets.map((a) => {
        a.dominance =
          totalBalance > 0
            ? formatNumber(a.balance / totalBalance, {
                style: 'percent',
                maximumFractionDigits: 2
              })
            : '0%';
        return a;
      })
    };

    return NextResponse.json<GetAssetWithTotalBalanceResponseData>(res, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
