/* eslint-disable react/jsx-newline */
'use client';

import { useState, type ChangeEvent, type FC } from 'react';
import { FiEdit } from 'react-icons/fi';
import {
  IoEllipsisHorizontal,
  IoSearchOutline,
  IoTrashBinOutline
} from 'react-icons/io5';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

import { SelectValue } from '@radix-ui/react-select';
import { RefreshCw } from 'lucide-react';

import {
  type AssetValuation,
  type GetAssetResponseData
} from '@/app/api/v1/assets';
import { formatNumber, formatPercent } from '@/common/utils';
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
import type { DecimalString, Maybe } from '@/types';

import { LimitPerPageOptions, type PageRequest } from '../page';
import { AssetValuationTableCells } from './asset-valuation-table-cells';

const NO_VALUE = '-';

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
  requestedPage: PageRequest;
  selectedSymbol: Maybe<string>;
  baseCurrency: Maybe<string>;
  result: Maybe<GetAssetResponseData>;
  valuations: Maybe<ReadonlyMap<string, AssetValuation>>;
  allocationBySymbol: Maybe<ReadonlyMap<string, DecimalString>>;
  investedValue: Maybe<DecimalString>;
};

type AssetsTableProps = {
  loading?: boolean;
  loadingValuations?: boolean;
  loadingShares?: boolean;
  caption?: string;
  data: AssetTableData;
  onDispatch: (type: DispatchType, payload?: unknown) => void;
};

export const AssetsTable: FC<AssetsTableProps> = ({
  loading,
  loadingValuations,
  loadingShares,
  caption,
  data,
  onDispatch
}) => {
  const [isAssetSelectionActive, setIsAssetSelectionActive] = useState(false);
  const [searchedAssetSymbol, setSearchedAssetSymbol] = useState('');

  const pagination = data.result?.pagination;

  const assets = searchedAssetSymbol.length
    ? (data.result?.assets || []).filter(({ symbol }) =>
        symbol.toUpperCase().includes(searchedAssetSymbol.toUpperCase())
      )
    : data.result?.assets || [];

  const formatAmount = (amount: Parameters<typeof formatNumber>[0]) =>
    formatNumber(
      amount,
      data.baseCurrency
        ? { style: 'currency', currency: data.baseCurrency }
        : { minimumFractionDigits: 2 }
    );

  const handleChangeSearchedAssetSymbol = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const { value } = e.target;
    setSearchedAssetSymbol(value);
  };

  const handleChangeActiveAssetSelection = () => {
    setIsAssetSelectionActive((prev) => !prev);
    if (data.selectedSymbol) onDispatch('setSelectedAsset', null);
  };

  return (
    <div className="space-y-32 sm:space-y-6">
      <section className="h-8 flex flex-col gap-3 mx-1 sm:flex-row sm:justify-between max-sm:mb-12">
        <Input
          placeholder="Search asset..."
          className="sm:w-48 bg-zinc-900"
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
              disabled={!data.selectedSymbol}
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

            <TableHead>Quantity</TableHead>

            <TableHead className="flex items-center gap-1.5">
              <span>Invested</span>

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

            <TableHead>Price</TableHead>

            <TableHead>Market Value</TableHead>

            <TableHead>P/L</TableHead>

            <TableHead>Dominance</TableHead>

            <TableHead>Transaction Orders</TableHead>

            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading &&
            Array.from({ length: data.requestedPage.limit }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={11} align="center" className="p-3">
                  <Skeleton className="w-full h-7" />
                </TableCell>
              </TableRow>
            ))}

          {!loading && !assets.length && (
            <TableRow>
              <TableCell
                colSpan={11}
                align="center"
                className="p-4 text-gray-400"
              >
                No assets to display
              </TableCell>
            </TableRow>
          )}

          {!loading &&
            assets?.map((asset, i) => {
              const share = data.allocationBySymbol?.get(asset.symbol);

              return (
                <TableRow key={asset.id}>
                  {!isAssetSelectionActive && <TableCell>{i + 1}</TableCell>}

                  {isAssetSelectionActive && (
                    <TableCell>
                      <Checkbox
                        checked={asset.symbol === data.selectedSymbol}
                        onCheckedChange={(checked) =>
                          onDispatch(
                            'setSelectedAsset',
                            checked ? asset.symbol : null
                          )
                        }
                      />
                    </TableCell>
                  )}

                  <TableCell>
                    <span className="font-semibold">{asset.symbol}</span>
                  </TableCell>

                  <TableCell>{asset.quantity}</TableCell>

                  <TableCell>{formatAmount(asset.investedValue)}</TableCell>

                  <TableCell>{formatAmount(asset.averageCost)}</TableCell>

                  <AssetValuationTableCells
                    loading={loadingValuations}
                    valuation={data.valuations?.get(asset.symbol)}
                  />

                  <TableCell>
                    {loadingShares ? (
                      <Skeleton className="w-3/4 h-5" />
                    ) : share ? (
                      formatPercent(share)
                    ) : (
                      NO_VALUE
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-2">
                      <span className="text-green-600">
                        {asset.transactionCount.buy} Buy
                      </span>

                      <span className="text-red-600">
                        {asset.transactionCount.sell} Sell
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="px-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Action"
                          className="h-8 sm:w-fit sm:self-end"
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
                            onClick={() =>
                              onDispatch('deleteAsset', asset.symbol)
                            }
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
              );
            })}
        </TableBody>

        {!loading && !!assets.length && (
          <TableFooter className="bg-transparent">
            <TableRow className="hover:bg-transparent">
              <TableCell className="px-3 py-1" colSpan={11}>
                <div className="flex">
                  <section className="w-1/2 flex justify-between">
                    <div className="w-fit flex items-center gap-1.5">
                      <span>Total</span>

                      <span className="font-semibold">
                        {loadingShares ? (
                          <Skeleton className="w-20 h-5" />
                        ) : data.investedValue ? (
                          formatAmount(data.investedValue)
                        ) : (
                          NO_VALUE
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Select
                        disabled={loading}
                        value={String(data.requestedPage.limit)}
                        onValueChange={(value: string) =>
                          onDispatch('setLimit', Number(value))
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

                  {!searchedAssetSymbol.length && pagination && (
                    <section className="w-1/2">
                      <Pagination className="justify-end">
                        <PaginationContent className="hover:cursor-pointer *:text-gray-200">
                          <Button
                            variant="link"
                            className="p-0"
                            aria-label="Previous"
                            disabled={pagination.page === 1}
                          >
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  onDispatch('setPage', pagination.page - 1)
                                }
                              />
                            </PaginationItem>
                          </Button>
                          {Array.from({
                            length: pagination.totalPages
                          }).map((_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                aria-label={`Page ${i + 1}`}
                                isActive={pagination.page === i + 1}
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
                            disabled={pagination.page === pagination.totalPages}
                          >
                            <PaginationItem>
                              <PaginationNext
                                onClick={() =>
                                  onDispatch('setPage', pagination.page + 1)
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
