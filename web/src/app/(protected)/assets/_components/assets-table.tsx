/* eslint-disable react/jsx-newline */
'use client';

import { useMemo, useState, type ChangeEvent, type FC } from 'react';
import { FiEdit } from 'react-icons/fi';
import {
  IoEllipsisHorizontal,
  IoSearchOutline,
  IoTrashBinOutline
} from 'react-icons/io5';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

import { SelectValue } from '@radix-ui/react-select';
import { RefreshCw } from 'lucide-react';

import { type Asset } from '@/app/api/v1/assets';
import { CURRENCIES } from '@/common/constants';
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Skeleton,
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
import type { Maybe, Pagination as TPagination } from '@/types';

import {
  LimitPerPageOptions,
  PaginationInitialState,
  type AssetsResult
} from '../page';
import { AssetTransactionTableCell } from './asset-transaction-table-cell';

export type DispatchType =
  | 'createAsset'
  | 'createAssetTransaction'
  | 'editAsset'
  | 'deleteAsset'
  | 'refetchAssets'
  | 'setSelectedAsset'
  | 'setSortOrder'
  | 'setLimit'
  | 'setPage';

type AssetTableData = {
  pagination: TPagination;
  selectedAsset: Maybe<Asset>;
  result: Maybe<AssetsResult>;
};

type AssetsTableProps = {
  loading?: boolean;
  caption?: string;
  data: AssetTableData;
  onDispatch: (type: DispatchType, payload?: unknown) => void;
};

export const AssetsTable: FC<AssetsTableProps> = ({
  loading,
  caption,
  data,
  onDispatch
}) => {
  const [isAssetSelectionActive, setIsAssetSelectionActive] = useState(false);
  const [searchedAssetSymbol, setSearchedAssetSymbol] = useState('');

  const { currency, changeCurrency } = useUser();

  const assets = useMemo(
    () =>
      searchedAssetSymbol.length
        ? (data?.result?.assets || []).filter(({ symbol }) =>
            symbol.toUpperCase().includes(searchedAssetSymbol.toUpperCase())
          )
        : data?.result?.assets || [],
    [searchedAssetSymbol, data]
  );

  const handleChangeSearchedAssetSymbol = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const { value } = e.target;
    setSearchedAssetSymbol(value);
  };

  const handleChangeCurrency = (v: string) =>
    changeCurrency(v as keyof typeof CURRENCIES);

  const handleChangeActiveAssetSelection = () => {
    setIsAssetSelectionActive((prev) => !prev);
    if (data.selectedAsset) onDispatch('setSelectedAsset', null);
  };

  return (
    <div className="space-y-[8rem] sm:space-y-6">
      <section className="h-8 flex flex-col gap-3 mx-1 sm:flex-row sm:justify-between max-sm:mb-12">
        <Input
          placeholder="Search asset..."
          className="sm:w-[12rem] bg-zinc-900"
          disabled={loading}
          onChange={handleChangeSearchedAssetSymbol}
          leftElement={<IoSearchOutline size={16} className="text-gray-500" />}
        />

        {!isAssetSelectionActive && (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-2">
            <Button
              variant="outline"
              aria-label="Refresh"
              className="h-8 bg-zinc-900 sm:self-end max-sm:w-full"
              disabled={loading}
              onClick={() => onDispatch('refetchAssets')}
            >
              <div className="flex items-center gap-2">
                <RefreshCw
                  size={16}
                  className={loading ? 'animate-spin' : ''}
                />

                <span>Refresh</span>
              </div>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Add"
                  className="h-8 sm:self-end max-sm:w-full"
                  disabled={loading}
                >
                  Add
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="space-x-2"
                    disabled={isAssetSelectionActive}
                    onClick={() => onDispatch('createAsset')}
                  >
                    <LuCoins size={16} className="text-gray-500" />

                    <span>New asset</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="space-x-2"
                    onClick={handleChangeActiveAssetSelection}
                  >
                    <LuArrowDownUp size={16} className="text-gray-500" />

                    <span>New transaction</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {isAssetSelectionActive && (
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
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
              disabled={!data.selectedAsset}
              onClick={() => onDispatch('createAssetTransaction')}
            >
              Confirm
            </Button>
          </div>
        )}
      </section>

      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}

        <TableHeader>
          <TableRow>
            {!isAssetSelectionActive ? <TableHead>#</TableHead> : <TableHead />}

            <TableHead>Asset</TableHead>

            <TableHead>Amount</TableHead>

            <TableHead className="flex items-center gap-1.5">
              <span>Balance</span>

              {/* <div className="flex flex-col relative cursor-pointer">
                <ChevronUp
                  size={10}
                  onClick={() => handleChangeSort('desc')}
                  className={twMerge(
                    'absolute bottom-[-2px] text-gray-600',
                    sort === 'desc' && 'text-text-gray-300'
                  )}
                />

                <ChevronDown
                  size={10}
                  onClick={() => handleChangeSort('asc')}
                  className={twMerge(
                    'absolute top-0 text-gray-600',
                    sort === 'asc' && 'text-gray-300'
                  )}
                />
              </div> */}
            </TableHead>

            <TableHead>Avg Price</TableHead>

            <TableHead>Dominance</TableHead>

            <TableHead>Transaction Orders</TableHead>

            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading &&
            Array.from({
              length: data?.pagination.limit ?? PaginationInitialState.limit
            }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={8} align="center" className="p-3">
                  <Skeleton className="w-full h-7" />
                </TableCell>
              </TableRow>
            ))}

          {!loading && !assets.length && (
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

          {!loading &&
            assets?.map((asset, i) => (
              <TableRow key={asset.id}>
                {!isAssetSelectionActive && <TableCell>{++i}</TableCell>}

                {isAssetSelectionActive && (
                  <TableCell>
                    <Checkbox
                      checked={asset.symbol === data.selectedAsset?.symbol}
                      onCheckedChange={(checked) =>
                        onDispatch('setSelectedAsset', checked ? asset : null)
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
                  symbol={asset.symbol}
                />

                <TableCell>{asset?.dominance ?? '-'}</TableCell>

                <AssetTransactionTableCell
                  itemRef="total_qty"
                  symbol={asset.symbol}
                />

                <TableCell className="px-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Action"
                        className="h-8 sm:w-[fit-content] sm:self-end"
                        disabled={loading}
                      >
                        <IoEllipsisHorizontal
                          size={18}
                          className="text-gray-300"
                        />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          aria-label="Edit"
                          className="space-x-2"
                          disabled={isAssetSelectionActive}
                          onClick={() => onDispatch('editAsset', asset)}
                        >
                          <FiEdit size={16} className="text-gray-500" />

                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          aria-label="Delete"
                          className="space-x-2"
                          disabled={isAssetSelectionActive}
                          onClick={() => onDispatch('deleteAsset', asset)}
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

        {!loading && !!assets.length && (
          <TableFooter className="bg-transparent">
            <TableRow className="hover:bg-transparent">
              <TableCell className="px-3 py-1" colSpan={8}>
                <div className="flex">
                  <section className="w-1/2 flex justify-between">
                    <div className="w-fit flex items-center gap-1.5">
                      <span>Total</span>

                      <Select
                        disabled={loading}
                        defaultValue={currency}
                        onValueChange={handleChangeCurrency}
                      >
                        <SelectTrigger
                          aria-label="Currency"
                          className="w-fit h-7 bg-zinc-900 sm:min-w-fit"
                        >
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>

                        <SelectContent>
                          {Object.values(CURRENCIES).map(({ id, symbol }) => (
                            <SelectItem key={id} value={id}>
                              {symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="font-semibold">
                        {formatNumber(data?.result?.totalBalance ?? 0, {
                          minimumFractionDigits: 2
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Select
                        disabled={loading}
                        defaultValue={String(
                          data?.pagination.limit ?? PaginationInitialState.limit
                        )}
                        onValueChange={(value: string) =>
                          onDispatch('setLimit', value)
                        }
                      >
                        <SelectTrigger
                          aria-label="Limit per page"
                          className="w-fit h-7 bg-zinc-900 sm:min-w-fit"
                        >
                          <SelectValue placeholder="Select limit" />
                        </SelectTrigger>

                        <SelectContent>
                          {LimitPerPageOptions.map((value) => (
                            <SelectItem key={value} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span>rows</span>
                    </div>
                  </section>

                  {!searchedAssetSymbol.length && data?.pagination && (
                    <section className="w-1/2">
                      <Pagination className="justify-end">
                        <PaginationContent className="hover:cursor-pointer [&>*]:text-gray-200">
                          <Button
                            variant="link"
                            className="p-0"
                            aria-label="Previous"
                            disabled={data.pagination.page === 1}
                          >
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  onDispatch(
                                    'setPage',
                                    data.pagination.page - 1
                                  )
                                }
                              />
                            </PaginationItem>
                          </Button>
                          {Array.from({
                            length: data.pagination.totalPages
                          }).map((_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                aria-label={`Page ${i + 1}`}
                                isActive={data.pagination.page === i + 1}
                                onClick={() => onDispatch('setPage', i + 1)}
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <Button
                            variant="link"
                            className="p-0"
                            aria-label="Next"
                            disabled={
                              data.pagination.page ===
                              data.result?.pagination.totalPages
                            }
                          >
                            <PaginationItem>
                              <PaginationNext
                                onClick={() =>
                                  onDispatch(
                                    'setPage',
                                    data.pagination.page + 1
                                  )
                                }
                              />
                            </PaginationItem>
                          </Button>
                        </PaginationContent>
                      </Pagination>
                    </section>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
};
