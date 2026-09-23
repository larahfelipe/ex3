import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

import type {
  SearchInstrumentsRequestParams,
  SearchInstrumentsResponseData
} from '@/app/api/v1/instruments';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { queryKeys } from '@/lib/react-query';

export const useInstrumentSearch = (query: string | null) =>
  useQuery<
    AxiosResponse<SearchInstrumentsResponseData>,
    ApiProxyErrorData,
    SearchInstrumentsResponseData
  >({
    queryKey: queryKeys.instrumentSearch(query),
    queryFn:
      query === null
        ? skipToken
        : () =>
            api.getInstance().get('/v1/instruments/search', {
              params: { query } satisfies SearchInstrumentsRequestParams
            }),
    select: ({ data }) => data,
    placeholderData: keepPreviousData
  });
