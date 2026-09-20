import { forwardToApi } from '@/lib/api-proxy';

import type { GetCurrentUserResponseData } from './types';

export const GET = () =>
  forwardToApi<GetCurrentUserResponseData>({
    method: 'get',
    path: '/v1/user'
  });
