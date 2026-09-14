import type { FC, JSX } from 'react';

import { useQuery } from '@tanstack/react-query';
import { type AxiosResponse } from 'axios';

import type { GetTransactionCountResponseData } from '@/app/api/v1/transactions';
import { Skeleton, TableCell } from '@/components/ui';
import api, { type ApiProxyErrorData } from '@/lib/axios';

type AssetTransactionTableCell = {
  symbol: string;
  portfolioId: string;
};

const NO_TRANSACTIONS: GetTransactionCountResponseData = { buy: 0, sell: 0 };

export const AssetTransactionTableCell: FC<AssetTransactionTableCell> = ({
  symbol,
  portfolioId
}): JSX.Element => {
  const { data: { buy, sell } = NO_TRANSACTIONS, isLoading } = useQuery<
    AxiosResponse<GetTransactionCountResponseData>,
    ApiProxyErrorData,
    GetTransactionCountResponseData
  >({
    queryKey: ['transactions', 'count', portfolioId, symbol],
    queryFn: () =>
      api.getInstance().get(`/v1/transactions/${symbol}/count`, {
        params: { portfolioId }
      }),
    select: ({ data }) => data,
    staleTime: 30_000
  });

  if (isLoading)
    return (
      <TableCell>
        <Skeleton className="w-1/2 h-5" />
      </TableCell>
    );

  return (
    <TableCell>
      <div className="flex gap-2">
        <span className="text-green-600">{buy} Buy</span>

        <span className="text-red-600">{sell} Sell</span>
      </div>
    </TableCell>
  );
};
