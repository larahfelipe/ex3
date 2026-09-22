import { forwardToApi } from '@/lib/api-proxy';

import type { GetInstrumentOptionsResponseData } from '../types';

export const GET = () =>
  forwardToApi<GetInstrumentOptionsResponseData>({
    method: 'get',
    path: '/v1/instruments/options'
  });
