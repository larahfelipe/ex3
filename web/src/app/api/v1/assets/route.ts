import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { APP_STORAGE_KEYS } from '@/common/constants';
import { formatNumber } from '@/common/utils';
import api, { ApiProxyError, type ApiProxyErrorData } from '@/lib/axios';

import type {
  GetAssetResponseData,
  GetAssetWithTotalInvestedValueResponseData
} from './types';

export const GET = async (req: NextRequest) => {
  try {
    const authToken = (await cookies()).get(APP_STORAGE_KEYS.Token);
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
        params: req.nextUrl.searchParams
      });

    const totalInvestedValue = data.assets.reduce((acc, curr) => {
      acc += Number(curr.investedValue);
      return acc;
    }, 0);

    const res: GetAssetWithTotalInvestedValueResponseData = {
      totalInvestedValue,
      sort: data.sort,
      pagination: data.pagination,
      assets: data.assets.map((a) => {
        a.dominance =
          totalInvestedValue > 0
            ? formatNumber(Number(a.investedValue) / totalInvestedValue, {
                style: 'percent',
                maximumFractionDigits: 2
              })
            : '0%';
        return a;
      })
    };

    return NextResponse.json<GetAssetWithTotalInvestedValueResponseData>(res, {
      status,
      statusText
    });
  } catch (e) {
    const { status, statusText, ...error } = e as ApiProxyError;

    return NextResponse.json<ApiProxyErrorData>(error, { status, statusText });
  }
};
