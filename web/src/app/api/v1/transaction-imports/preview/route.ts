import type { NextRequest } from 'next/server';

import { REQUEST_LIMITS, TRANSACTION_IMPORT } from '@/common/constants';
import { forwardToApi } from '@/lib/api-proxy';

import type { PreviewTransactionImportResponseData } from '../types';

export const POST = (req: NextRequest) =>
  forwardToApi<PreviewTransactionImportResponseData>({
    method: 'post',
    path: '/v1/transaction-import/preview',
    payloadFrom: req,
    maxPayloadBytes: REQUEST_LIMITS.UploadBodyBytes,
    timeoutMs: TRANSACTION_IMPORT.RequestTimeoutMs
  });
