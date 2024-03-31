/* eslint-disable react/jsx-newline */
'use client';

import { useEffect, useState, type ChangeEvent, type FC } from 'react';
import { FiEdit } from 'react-icons/fi';
import {
  IoEllipsisHorizontal,
  IoSearchOutline,
  IoTrashBinOutline
} from 'react-icons/io5';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

import { SelectValue } from '@radix-ui/react-select';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { getAssets, type Asset, type GetAssetsParams } from '@/api/get-assets';
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
import type { Maybe } from '@/types';

import { AssetTransactionTableCell } from './asset-transaction-table-cell';

export type ActionType = (typeof TABLE_ACTIONS)[keyof typeof TABLE_ACTIONS];

type AssetsState = {
  list: Array<Asset>;
  sort: GetAssetsParams['sort'];
};

type AssetsTableProps = {
  caption?: string;
  onAction: (type: ActionType, payload?: Asset) => void;
};

export const AssetsTable: FC<AssetsTableProps> = ({ caption, onAction }) => {
  const [isAssetSelectionActive, setIsAssetSelectionActive] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Maybe<Asset>>(null);
  const [enteredAssetSymbol, setEnteredAssetSymbol] = useState('');
  const [assetCollection, setAssetCollection] = useState<AssetsState>({
    list: [],
    sort: 'desc'
  });

  const { currency, changeCurrency } = useUser();

  const { data, isLoading } = useQuery({
    queryKey: ['assets', assetCollection.sort],
    queryFn: () => getAssets({ sort: assetCollection.sort }),
    select: ({ data }) => {
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

      return { totalBalance, sort: data.sort, assets: assetsWithDominance };
    },
    staleTime: 60000
  });

  const handleChangeEnteredAssetName = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setEnteredAssetSymbol(value);
  };

  const handleChangeSort = (v: string) =>
    setAssetCollection((state) => ({
      ...state,
      sort: v as GetAssetsParams['sort']
    }));

  const handleChangeCurrency = (v: string) =>
    changeCurrency(v as keyof typeof CURRENCIES);

  const handleOnAction = (type: ActionType, payload?: Asset) => {
    onAction(type, payload);
    if (type === 'add-transaction') setIsAssetSelectionActive(false);
  };

  const handleChangeActiveAssetSelection = () => {
    setIsAssetSelectionActive((prev) => !prev);
    if (selectedAsset) setSelectedAsset(null);
  };

  useEffect(() => {
    if (!data?.assets?.length) return;

    setAssetCollection((state) => ({
      ...state,
      list: enteredAssetSymbol
        ? data.assets.filter(({ symbol }) =>
            symbol.includes(enteredAssetSymbol.toUpperCase())
          )
        : data.assets
    }));
  }, [data, enteredAssetSymbol]);

  return (
    <div className="flex flex-col gap-20 sm:gap-4">
      <div className="h-8 flex flex-col gap-3 mx-1 sm:flex-row sm:justify-between max-sm:mx-4 max-sm:mb-6">
        <Input
          placeholder="Search asset..."
          className="sm:w-[12rem] bg-gray-50"
          disabled={isLoading}
          onChange={handleChangeEnteredAssetName}
          leftElement={<IoSearchOutline size={16} className="text-gray-500" />}
        />

        {!isAssetSelectionActive && (
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
                  onClick={() => handleOnAction('add-asset')}
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
        )}

        {isAssetSelectionActive && (
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-1">
            <Button
              variant="secondary"
              aria-label="Cancel"
              className="h-8"
              onClick={handleChangeActiveAssetSelection}
            >
              Cancel
            </Button>

            <Button
              aria-label="Confirm"
              className="h-8"
              disabled={!selectedAsset}
              onClick={() =>
                handleOnAction('add-transaction', selectedAsset as Asset)
              }
            >
              Confirm
            </Button>
          </div>
        )}
      </div>

      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}

        <TableHeader>
          <TableRow>
            {!isAssetSelectionActive ? <TableHead>#</TableHead> : <TableHead />}

            <TableHead>Asset</TableHead>

            <TableHead>Amount</TableHead>

            <TableHead className="flex items-center gap-1.5">
              <span>Balance</span>

              <div className="flex flex-col relative cursor-pointer">
                <ChevronUp
                  size={10}
                  onClick={() => handleChangeSort('desc')}
                  className={twMerge(
                    'absolute bottom-[-2px] text-gray-400',
                    assetCollection.sort === 'desc' && 'text-black'
                  )}
                />

                <ChevronDown
                  size={10}
                  onClick={() => handleChangeSort('asc')}
                  className={twMerge(
                    'absolute top-0 text-gray-400',
                    assetCollection.sort === 'asc' && 'text-black'
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

          {!isLoading && !assetCollection.list.length && (
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
            !!assetCollection.list.length &&
            assetCollection.list.map((asset, i) => (
              <TableRow key={asset.id}>
                {!isAssetSelectionActive && <TableCell>{++i}</TableCell>}

                {isAssetSelectionActive && (
                  <TableCell>
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

                <TableCell>
                  {asset.balance.toLocaleString('en-US', {
                    style: 'currency',
                    currency
                  })}
                </TableCell>

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
                          onClick={() => handleOnAction('edit', asset)}
                        >
                          <FiEdit size={16} className="text-gray-700" />

                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          aria-label="Delete"
                          className="space-x-2"
                          disabled={isAssetSelectionActive}
                          onClick={() => handleOnAction('delete', asset)}
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

        {!isLoading && !!assetCollection.list.length && (
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
