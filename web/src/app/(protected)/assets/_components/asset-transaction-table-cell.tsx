import type { FC } from 'react';

import { useQuery } from '@tanstack/react-query';
import { type AxiosResponse } from 'axios';

import type {
  GetTransactionsResponseData,
  Transaction
} from '@/app/api/v1/transactions';
import { TRANSACTION_TYPES } from '@/common/constants';
import { formatNumber } from '@/common/utils';
import { Skeleton, TableCell } from '@/components/ui';
import { useUser } from '@/hooks/use-user';
import api, { type ApiErrorData } from '@/lib/axios';

type AssetTransactionTableCell = {
  symbol: string;
  itemRef: 'total_qty' | 'avg_price';
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

const getAssetPriceAverage = (transactions: Array<Transaction>) => {
  if (!transactions?.length) return 0;

  const total = transactions.reduce(
    (acc, curr) => ({
      cost: acc.cost + curr.price * curr.amount,
      amount: (acc.amount += curr.amount)
    }),
    { cost: 0, amount: 0 }
  );

  return total.cost / total.amount;
};

export const AssetTransactionTableCell: FC<AssetTransactionTableCell> = ({
  symbol,
  itemRef
}): JSX.Element => {
  const { currency } = useUser();

  const { data: transactions = [], isLoading } = useQuery<
    AxiosResponse<GetTransactionsResponseData>,
    ApiErrorData,
    Array<Transaction>
  >({
    queryKey: ['transactions', symbol],
    queryFn: () => api.client.get(`/v1/transactions/${symbol}`),
    select: ({ data }) => data.transactions,
    staleTime: 30_000
  });

  if (isLoading)
    return (
      <TableCell>
        <Skeleton className="w-1/2 h-5" />
      </TableCell>
    );

  switch (itemRef) {
    case 'total_qty': {
      const [buyQty, sellQty] = getTotalTransactionsTuple(transactions);
      return (
        <TableCell>
          <div className="flex gap-2">
            <span className="text-green-600">{buyQty} Buy</span>

            <span className="text-red-600">{sellQty} Sell</span>
          </div>
        </TableCell>
      );
    }
    case 'avg_price':
      return (
        <TableCell>
          {formatNumber(getAssetPriceAverage(transactions), {
            style: 'currency',
            currency
          })}
        </TableCell>
      );
    default:
      return <TableCell>Outside range</TableCell>;
  }
};
