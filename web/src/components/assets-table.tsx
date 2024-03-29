/* eslint-disable react/jsx-newline */
'use client';

import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type ChangeEvent,
  type FC
} from 'react';
import { FiEdit } from 'react-icons/fi';
import {
  IoBanSharp,
  IoCheckmarkSharp,
  IoEllipsisHorizontal,
  IoSearchOutline,
  IoTrashBinOutline
} from 'react-icons/io5';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

import { SelectValue } from '@radix-ui/react-select';
import { useQuery } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { getAssets } from '@/api/get-assets';
import { CURRENCIES, type TABLE_ACTIONS } from '@/common/constants';
import { formatNumber } from '@/common/utils';
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
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

interface WithDominance {
  dominance?: string;
}

export interface Asset extends WithDominance {
  id: string;
  symbol: string;
  amount: number;
  balance: number;
  portfolioId: string;
}

type ReducerState = {
  assets: Array<Asset>;
  sort: 'asc' | 'desc';
};

type ReducerAction = {
  type: `sort_${ReducerState['sort']}`;
  payload?: unknown;
};

export type ActionType = (typeof TABLE_ACTIONS)[keyof typeof TABLE_ACTIONS];

type AssetsTableProps = {
  caption?: string;
  onAction: (type: ActionType, payload?: Asset) => void;
};

const reducer = (state: ReducerState, { type, payload }: ReducerAction) => {
  const data = (payload as Array<Asset>) || state.assets;

  switch (type) {
    case 'sort_asc':
    case 'sort_desc': {
      const sortOrder = type.split('_')[1] as ReducerState['sort'];

      const compare: (a: Asset, b: Asset) => number =
        sortOrder === 'asc'
          ? (a, b) => a.balance - b.balance
          : (a, b) => b.balance - a.balance;

      return { ...state, sort: sortOrder, assets: data.sort(compare) };
    }
    default:
      return state;
  }
};

export const AssetsTable: FC<AssetsTableProps> = ({ caption, onAction }) => {
  const [{ assets, sort }, dispatch] = useReducer(reducer, {
    assets: [],
    sort: 'desc'
  });
  const [isAssetSelectionActive, setIsAssetSelectionActive] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [enteredAssetSymbol, setEnteredAssetSymbol] = useState('');

  const { currency, changeCurrency } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: getAssets,
    select: ({ data }: AxiosResponse<Record<'assets', Array<Asset>>>) => {
      const totalBalance = data.assets.reduce(
        (acc, curr) => (acc += curr.balance),
        0
      );
      const assetsWithDominance = data.assets.map((a) => {
        a.dominance = formatNumber(a.balance / totalBalance, {
          style: 'percent',
          maximumFractionDigits: 2
        });
        return a;
      });

      return { totalBalance, assets: assetsWithDominance };
    }
  });

  const formatCurrencyValue = useCallback(
    (value: number) => formatNumber(value, { style: 'currency', currency }),
    [currency]
  );

  const handleChangeEnteredAssetName = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setEnteredAssetSymbol(value);
  };

  const handleChangeSort = (v: string) =>
    dispatch({ type: ('sort_' + v) as ReducerAction['type'] });

  const handleChangeCurrency = (v: string) =>
    changeCurrency(v as keyof typeof CURRENCIES);

  const handleChangeActiveAssetSelection = () => {
    setIsAssetSelectionActive((prev) => !prev);
    if (selectedAsset) setSelectedAsset(null);
  };

  useEffect(() => {
    if (!data?.assets?.length) return;

    const parsedAssets = enteredAssetSymbol.length
      ? data.assets.filter(({ symbol }) =>
          symbol.includes(enteredAssetSymbol.toUpperCase())
        )
      : data.assets;

    dispatch({
      type: `sort_${sort}` as ReducerAction['type'],
      payload: parsedAssets
    });
  }, [data, enteredAssetSymbol, sort]);

  return (
    <div className="flex flex-col gap-20 sm:gap-4">
      <div className="h-8 flex flex-col gap-3 mx-1 sm:flex-row sm:justify-between max-sm:mx-4">
        <Input
          placeholder="Search asset..."
          className="sm:w-[12rem] bg-gray-50"
          disabled={isLoading}
          onChange={handleChangeEnteredAssetName}
          leftElement={<IoSearchOutline size={16} className="text-gray-500" />}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Add"
              className="h-8 sm:self-end"
              disabled={isLoading}
            >
              Add
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="space-x-2"
                disabled={isAssetSelectionActive}
                onClick={() => onAction('add-asset')}
              >
                <LuCoins size={16} className="text-gray-700" />

                <span>New asset</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="space-x-2"
                onClick={handleChangeActiveAssetSelection}
              >
                <LuArrowDownUp size={16} className="text-gray-700" />

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
            {!isAssetSelectionActive && <TableHead>#</TableHead>}

            {isAssetSelectionActive && (
              <TableHead className="flex justify-center items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Cancel"
                  className="bg-red-100 hover:bg-red-200"
                  onClick={handleChangeActiveAssetSelection}
                >
                  <IoBanSharp size={16} className="text-red-600" />
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  aria-label="Confirm"
                  className="bg-green-100 hover:bg-green-200"
                  disabled={!selectedAsset}
                  onClick={() =>
                    onAction('add-transaction', selectedAsset as Asset)
                  }
                >
                  <IoCheckmarkSharp size={16} className="text-green-600" />
                </Button>
              </TableHead>
            )}

            <TableHead>Asset</TableHead>

            <TableHead>Amount</TableHead>

            <TableHead className="flex items-center gap-1.5">
              <span>Balance</span>

              <div className="flex flex-col relative cursor-pointer">
                <ChevronUp
                  size={10}
                  onClick={() => handleChangeSort('des')}
                  className={twMerge(
                    'absolute bottom-[-2px] text-gray-400',
                    sort === 'desc' && 'text-black'
                  )}
                />

                <ChevronDown
                  size={10}
                  onClick={() => handleChangeSort('asc')}
                  className={twMerge(
                    'absolute top-0 text-gray-400',
                    sort === 'asc' && 'text-black'
                  )}
                />
              </div>
            </TableHead>

            <TableHead>Avg Price</TableHead>

            <TableHead>Dominance</TableHead>

            <TableHead>Transaction Orders</TableHead>

            <TableHead />
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
                className="p-4 text-gray-400"
              >
                No assets to display
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !!assets?.length &&
            assets.map((asset, i) => (
              <TableRow key={asset.id}>
                {!isAssetSelectionActive && <TableCell>{++i}</TableCell>}

                {isAssetSelectionActive && (
                  <TableCell align="center">
                    <Checkbox
                      checked={asset.symbol === selectedAsset?.symbol}
                      onCheckedChange={(checked) =>
                        setSelectedAsset(checked ? asset : null)
                      }
                    />
                  </TableCell>
                )}

                <TableCell>
                  <span className="font-semibold">{asset.symbol}</span>
                </TableCell>

                <TableCell>{asset.amount}</TableCell>

                <TableCell>{formatCurrencyValue(asset.balance)}</TableCell>

                <AssetTransactionTableCell
                  itemRef="avg_price"
                  assetId={asset.id}
                />

                <TableCell>{asset?.dominance ?? '-'}</TableCell>

                <AssetTransactionTableCell
                  itemRef="total_qty"
                  assetId={asset.id}
                />

                <TableCell className="px-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Action"
                        className="h-8 sm:w-[fit-content] sm:self-end"
                        disabled={isLoading}
                      >
                        <IoEllipsisHorizontal
                          size={18}
                          className="text-gray-600"
                        />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          aria-label="Edit"
                          className="space-x-2"
                          disabled={isAssetSelectionActive}
                          onClick={() => onAction('edit', asset)}
                        >
                          <FiEdit size={16} className="text-gray-700" />

                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          aria-label="Delete"
                          className="space-x-2"
                          onClick={() => onAction('delete', asset)}
                        >
                          <IoTrashBinOutline
                            size={16}
                            className="text-red-500"
                          />

                          <span className="text-red-500">Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>

        {!isLoading && !!assets?.length && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={7}>Total</TableCell>

              <TableCell align="right">
                <div className="w-fit flex items-center gap-1.5 font-semibold">
                  <Select
                    disabled={isLoading}
                    defaultValue={currency}
                    onValueChange={handleChangeCurrency}
                  >
                    <SelectTrigger className="w-fit h-7 self-end sm:min-w-fit">
                      <SelectValue
                        aria-label="Currency"
                        placeholder="Select currency"
                      />
                    </SelectTrigger>

                    <SelectContent>
                      {Object.values(CURRENCIES).map(({ id, symbol }) => (
                        <SelectItem key={id} value={id}>
                          {symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span>
                    {formatNumber(data?.totalBalance ?? 0, {
                      minimumFractionDigits: 2
                    })}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
};
