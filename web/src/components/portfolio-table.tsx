'use client';

import { getPortfolio } from '@/api/get-portfolio';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState, type FC } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import { SelectValue } from '@radix-ui/react-select';
import type { AxiosResponse } from 'axios';
import { Loader2 } from 'lucide-react';
import { FiEdit, FiPlus, FiTrash } from 'react-icons/fi';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

export type ActionType = (typeof TABLE_ACTIONS)[keyof typeof TABLE_ACTIONS];

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

export type Asset = {
  id: string;
  symbol: string;
  amount: number;
  balance: number;
  transactions: Array<Transaction>;
  portfolioId: string;
};

export type Portfolio = {
  id: string;
  assets: Array<Asset>;
  userId: string;
};

type PortfolioTableProps = {
  caption?: string;
  onAction: (type: ActionType, payload?: Asset) => void;
};

const TABLE_ACTIONS = {
  AddAsset: 'add-asset',
  AddTransaction: 'add-transaction',
  Edit: 'edit',
  Delete: 'delete'
} as const;

const getAssetsTotalBalance = (assets: Array<Asset>) =>
  assets.reduce((acc, curr) => (acc += curr.balance), 0);

const getAssetPriceAverage = (transactions: Array<Transaction>) => {
  if (!transactions.length) return 0;

  const totalCost = transactions.reduce((acc, curr) => {
    return acc + curr.price * curr.amount;
  }, 0);
  const totalAmount = transactions.reduce(
    (acc, curr) => (acc += curr.amount),
    0
  );

  return totalCost / totalAmount;
};

export const PortfolioTable: FC<PortfolioTableProps> = ({
  caption,
  onAction
}) => {
  const [currency, setCurrency] = useState('pt-BR');

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: getPortfolio,
    select: ({ data }: AxiosResponse<Portfolio>) => data
  });

  const formatValue = useCallback(
    (value: number) =>
      new Intl.NumberFormat('en-US', { currency }).format(value),
    [currency]
  );

  const handleChangeCurrency = (v: string) => setCurrency(v);

  return (
    <div className="flex flex-col gap-4 sm:gap-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:w-1/6 sm:min-w-[fit-content] sm:self-end">
        <Select
          disabled={isLoading}
          defaultValue={currency}
          onValueChange={handleChangeCurrency}
        >
          <SelectTrigger className="h-8">
            <SelectValue aria-label="Currency" placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en-US">Dollar ($)</SelectItem>
            <SelectItem value="pt-BR">Real (R$)</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Add"
              className="h-8 space-x-1.5 sm:w-[fit-content] sm:self-end"
              disabled={isLoading}
            >
              <FiPlus size={18} />
              <span>Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => onAction('add-asset')}
              >
                <LuCoins size={14} />
                <span>New asset</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => onAction('add-transaction')}
              >
                <LuArrowDownUp size={14} />
                <span>New transaction</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Price (avg)</TableHead>
            <TableHead>Transactions (qty)</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} align="center" className="p-4">
                <Loader2 className="size-5 animate-spin" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !portfolio?.assets?.length && (
            <TableRow>
              <TableCell
                colSpan={6}
                align="center"
                className="p-4 text-slate-400"
              >
                No assets found in your portfolio. Try add one to get started
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !!portfolio?.assets?.length &&
            portfolio?.assets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell>{asset.symbol}</TableCell>

                <TableCell>{asset.amount}</TableCell>

                <TableCell>{formatValue(asset.balance)}</TableCell>

                <TableCell>
                  {formatValue(getAssetPriceAverage(asset.transactions))}
                </TableCell>

                <TableCell>{asset.transactions.length}</TableCell>

                <TableCell>
                  <Button
                    variant="ghost"
                    aria-label="Edit"
                    className="space-x-1.5"
                    onClick={() => onAction(TABLE_ACTIONS.Edit, asset)}
                  >
                    <FiEdit size={18} />
                    <span className="text-xs">Edit</span>
                  </Button>

                  <Button
                    variant="ghost"
                    aria-label="Delete"
                    className="space-x-1.5 hover:bg-red-50"
                    onClick={() => onAction(TABLE_ACTIONS.Delete, asset)}
                  >
                    <FiTrash size={18} className="text-red-500" />
                    <span className="text-red-500 text-xs">Delete</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
        {!isLoading && !!portfolio?.assets?.length && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5}>Total</TableCell>
              <TableCell className="text-right font-semibold">
                {formatValue(getAssetsTotalBalance(portfolio.assets))}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
};
