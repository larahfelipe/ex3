import { useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

import type { GetCurrentUserResponseData } from '@/app/api/v1/user';
import api, { type ApiProxyErrorData } from '@/lib/axios';

export const useCurrentUser = () =>
  useQuery<
    AxiosResponse<GetCurrentUserResponseData>,
    ApiProxyErrorData,
    GetCurrentUserResponseData['user']
  >({
    queryKey: ['user'],
    queryFn: () => api.getInstance().get('/v1/user'),
    select: ({ data }) => data.user
  });
