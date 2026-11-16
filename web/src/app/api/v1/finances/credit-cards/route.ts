import { forwardToApi } from '@/lib/api-proxy';

import type { GetCreditCardsResponseData } from '../types';

export const GET = () =>
  forwardToApi<GetCreditCardsResponseData>({
    method: 'get',
    path: '/v1/finances/credit-cards'
  });
