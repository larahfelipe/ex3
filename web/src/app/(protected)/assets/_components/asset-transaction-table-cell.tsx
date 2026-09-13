import type { FC, JSX } from 'react';

import { useQuery } from '@tanstack/react-query';
import { type AxiosResponse } from 'axios';

import type {
  GetTransactionsResponseData,
  Transaction
} from '@/app/api/v1/transactions';
import { TRANSACTION_TYPES } from '@/common/constants';
import { Skeleton, TableCell } from '@/components/ui';
import api, { type ApiProxyErrorData } from '@/lib/axios';

type AssetTransactionTableCell = {
  symbol: string;
  portfolioId: string;
};

const getTotalTransactionsTuple = (transactions: Array<Transaction>) => {
  const initialValue: [number, number] = [0, 0];
  if (!transactions?.length) return initialValue;

  return transactions.reduce<[number, number]>(
    (acc, curr) =>
      curr.type === TRANSACTION_TYPES[0]
        ? [++acc[0], acc[1]]
        : [acc[0], ++acc[1]],
    initialValue
  );
};

export const AssetTransactionTableCell: FC<AssetTransactionTableCell> = ({
  symbol,
  portfolioId
}): JSX.Element => {
  const { data: transactions = [], isLoading } = useQuery<
    AxiosResponse<GetTransactionsResponseData>,
    ApiProxyErrorData,
    Array<Transaction>
  >({
    queryKey: ['transactions', portfolioId, symbol],
    queryFn: () =>
      api.getInstance().get(`/v1/transactions/${symbol}`, {
        params: { portfolioId }
      }),
    select: ({ data }) => data.transactions,
    staleTime: 30_000
  });

  if (isLoading)
    return (
      <TableCell>
        <Skeleton className="w-1/2 h-5" />
      </TableCell>
    );

  const [buyQty, sellQty] = getTotalTransactionsTuple(transactions);

  return (
    <TableCell>
      <div className="flex gap-2">
        <span className="text-green-600">{buyQty} Buy</span>

        <span className="text-red-600">{sellQty} Sell</span>
      </div>
    </TableCell>
  );
};
