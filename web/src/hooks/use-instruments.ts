import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

import type {
  GetInstrumentOptionsResponseData,
  GetInstrumentsRequestParams,
  GetInstrumentsResponseData
} from '@/app/api/v1/instruments';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';

export const useInstruments = (params: GetInstrumentsRequestParams) =>
  useQuery<
    AxiosResponse<GetInstrumentsResponseData>,
    ApiProxyErrorData,
    GetInstrumentsResponseData
  >({
    queryKey: queryKeys.instruments(params),
    queryFn: () =>
      api.getInstance().get('/v1/instruments', {
        params: params satisfies GetInstrumentsRequestParams
      }),
    select: ({ data }) => data,
    placeholderData: keepPreviousData
  });

/** The options change only with an API release, so they are fetched once per session. */
export const useInstrumentOptions = () =>
  useQuery<
    AxiosResponse<GetInstrumentOptionsResponseData>,
    ApiProxyErrorData,
    GetInstrumentOptionsResponseData
  >({
    queryKey: queryKeys.instrumentOptions(),
    queryFn: () => api.getInstance().get('/v1/instruments/options'),
    select: ({ data }) => data,
    staleTime: Infinity
  });
