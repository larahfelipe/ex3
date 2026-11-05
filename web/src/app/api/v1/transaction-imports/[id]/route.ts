import type { NextRequest } from 'next/server';

import { forwardToApi } from '@/lib/api-proxy';

import type { UndoTransactionImportResponseData } from '../types';

type TransactionImportRouteContext = Record<
  'params',
  Promise<Record<'id', string>>
>;

export const DELETE = async (
  _req: NextRequest,
  { params }: TransactionImportRouteContext
) => {
  const { id } = await params;

  return forwardToApi<UndoTransactionImportResponseData>({
    method: 'delete',
    path: `/v1/transaction-import/${encodeURIComponent(id)}`
  });
};
