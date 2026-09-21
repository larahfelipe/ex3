import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

import type {
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
