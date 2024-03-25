/* eslint-disable react/jsx-newline */
'use client';

import { useCallback, useEffect, useMemo, useReducer, type FC } from 'react';
import { FiEdit, FiPlus, FiTrash } from 'react-icons/fi';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

import { SelectValue } from '@radix-ui/react-select';
import { useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { Loader2 } from 'lucide-react';

import { getAssets } from '@/api/get-assets';
import { CURRENCIES, TABLE_ACTIONS } from '@/common/constants';
import { formatNumber } from '@/common/utils';
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
import { useUser } from '@/hooks/use-user';

import { AssetTransactionTableCell } from './asset-transaction-table-cell';

export type Asset = {
  id: string;
  symbol: string;
  amount: number;
  balance: number;
  portfolioId: string;
};

type ReduceState = {
  assets: Array<Asset>;
  sort: 'asc' | 'des';
};

type ReduceAction = {
  type: `sort_${ReduceState['sort']}`;
  payload?: unknown;
};

export type ActionType = (typeof TABLE_ACTIONS)[keyof typeof TABLE_ACTIONS];

type AssetsTableProps = {
  caption?: string;
  onAction: (type: ActionType, payload?: Asset) => void;
};

const reducer = (state: ReduceState, action: ReduceAction): ReduceState => {
  const data = (action.payload as Array<Asset>) || state.assets;

  switch (action.type) {
    case 'sort_asc':
      return {
        assets: data.sort((a, b) => a.balance - b.balance),
        sort: 'asc'
      };
    case 'sort_des':
      return {
        assets: data.sort((a, b) => b.balance - a.balance),
        sort: 'des'
      };
    default:
      return state;
  }
};

export const AssetsTable: FC<AssetsTableProps> = ({ caption, onAction }) => {
  const [{ assets, sort }, dispatch] = useReducer(reducer, {
    assets: [],
    sort: 'des'
  });

  const { currency, changeCurrency } = useUser();

  const { data: maybeAssets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: getAssets,
    select: ({ data }: AxiosResponse<Record<'assets', Array<Asset>>>) =>
      data.assets
  });

  const totalBalance = useMemo(
    () => assets.reduce((acc, curr) => (acc += curr.balance), 0),
    [assets]
  );

  const formatCurrencyValue = useCallback(
    (value: number) => formatNumber(value, { style: 'currency', currency }),
    [currency]
  );

  const handleChangeSort = (v: string) =>
    dispatch({ type: ('sort_' + v) as ReduceAction['type'] });

  const handleChangeCurrency = (v: string) =>
    changeCurrency(v as keyof typeof CURRENCIES);

  useEffect(() => {
    if (!maybeAssets) return;

    dispatch({
      type: ('sort_' + sort) as ReduceAction['type'],
      payload: maybeAssets
    });
  }, [maybeAssets, sort]);

  return (
    <div className="flex flex-col gap-4 sm:gap-1">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:w-1/6 sm:min-w-[fit-content] sm:self-end">
        <Select
          disabled={isLoading}
          defaultValue={sort}
          onValueChange={handleChangeSort}
        >
          <SelectTrigger className="h-8">
            <SelectValue aria-label="Sort" placeholder="Sort preference" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="asc">Ascendent</SelectItem>
            <SelectItem value="des">Descendent</SelectItem>
          </SelectContent>
        </Select>

        <Select
          disabled={isLoading}
          defaultValue={currency}
          onValueChange={handleChangeCurrency}
        >
          <SelectTrigger className="h-8">
            <SelectValue aria-label="Currency" placeholder="Select currency" />
          </SelectTrigger>

          <SelectContent>
            {Object.values(CURRENCIES).map(({ id, name, symbol }) => (
              <SelectItem key={id} value={id}>
                {name} ({symbol})
              </SelectItem>
            ))}
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
            <TableHead>#</TableHead>

            <TableHead>Asset</TableHead>

            <TableHead>Amount</TableHead>

            <TableHead>Balance ({CURRENCIES[currency].symbol})</TableHead>

            <TableHead>Avg Price ({CURRENCIES[currency].symbol})</TableHead>

            <TableHead>Dominance (%)</TableHead>

            <TableHead>Qty Transactions</TableHead>

            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={8} align="center" className="p-4">
                <Loader2 className="size-5 animate-spin" />
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !assets?.length && (
            <TableRow>
              <TableCell
                colSpan={8}
                align="center"
                className="p-4 text-slate-400"
              >
                No assets found in your portfolio. Try add one to get started
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !!assets?.length &&
            assets.map((asset, i) => (
              <TableRow key={asset.id}>
                <TableCell>{++i}</TableCell>

                <TableCell>
                  <span className="font-semibold">{asset.symbol}</span>
                </TableCell>

                <TableCell>{asset.amount}</TableCell>

                <TableCell>{formatCurrencyValue(asset.balance)}</TableCell>

                <AssetTransactionTableCell
                  itemRef="avg_price"
                  assetId={asset.id}
                />

                <TableCell>{(asset.balance / totalBalance) * 100}%</TableCell>

                <AssetTransactionTableCell
                  itemRef="total_qty"
                  assetId={asset.id}
                />

                <TableCell className="px-0">
                  <Button
                    variant="ghost"
                    aria-label="Edit"
                    className="space-x-1.5"
                    onClick={() => onAction(TABLE_ACTIONS.Edit, asset)}
                  >
                    <FiEdit size={18} className="text-slate-700" />

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

        {!isLoading && !!assets?.length && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={7}>Total</TableCell>

              <TableCell className="text-right font-semibold">
                {formatCurrencyValue(totalBalance)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
};
