import type { FC } from 'react';

import { useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

import { getTransactions } from '@/api/get-transactions';
import { formatNumber } from '@/common/utils';
import { useUser } from '@/hooks/use-user';

import { Skeleton, TableCell } from './ui';

type TransactionType = 'BUY' | 'SELL';

type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  price: number;
  createdAt: Date;
  updatedAt: Date;
  assetId: string;
};

type AssetTransactionTableCell = {
  assetId: string;
  itemRef: 'total_qty' | 'avg_price';
};

const getTotalTransactionsTuple = (transactions: Array<Transaction>) => {
  const initialValue: [number, number] = [0, 0];
  if (!transactions?.length) return initialValue;

  const totalTransactions = transactions.reduce<[number, number]>(
    (acc, curr) =>
      curr.type === 'BUY' ? [++acc[0], acc[1]] : [acc[0], ++acc[1]],
    initialValue
  );

  return totalTransactions;
};

const getAssetPriceAverage = (transactions: Array<Transaction>) => {
  if (!transactions?.length) return 0;

  const totalCost = transactions.reduce((acc, curr) => {
    return acc + curr.price * curr.amount;
  }, 0);
  const totalAmount = transactions.reduce(
    (acc, curr) => (acc += curr.amount),
    0
  );

  return totalCost / totalAmount;
};

export const AssetTransactionTableCell: FC<AssetTransactionTableCell> = ({
  assetId,
  itemRef
}): JSX.Element => {
  const { currency } = useUser();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', assetId],
    queryFn: () => getTransactions(assetId),
    select: ({
      data
    }: AxiosResponse<Record<'transactions', Array<Transaction>>>) =>
      data.transactions
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
