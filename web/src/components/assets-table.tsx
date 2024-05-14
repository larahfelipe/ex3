/* eslint-disable react/jsx-newline */
'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FC
} from 'react';
import { FiEdit } from 'react-icons/fi';
import {
  IoEllipsisHorizontal,
  IoSearchOutline,
  IoTrashBinOutline
} from 'react-icons/io5';
import { LuArrowDownUp, LuCoins } from 'react-icons/lu';

import { useSearchParams } from 'next/navigation';

import { SelectValue } from '@radix-ui/react-select';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
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

import { AssetTransactionTableCell } from './asset-transaction-table-cell';

export type ActionType = (typeof TABLE_ACTIONS)[keyof typeof TABLE_ACTIONS];

type AssetsState = {
  list: Array<Asset>;
  pagination: TPagination;
  sort: GetAssetsParams['sort'];
};

type AssetsTableProps = {
  caption?: string;
  revalidate: number;
  onAction: (type: ActionType, payload?: Asset) => void;
};

const LimitPerPageOptions = ['5', '10', '25', '50'];

const PaginationInitialState: TPagination = {
  page: 1,
  total: 1,
  totalPages: 1,
  limit: +LimitPerPageOptions[0]
};

export const AssetsTable: FC<AssetsTableProps> = ({
  caption,
  revalidate,
  onAction
}) => {
  const [isAssetSelectionActive, setIsAssetSelectionActive] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Maybe<Asset>>(null);
  const [enteredAssetSymbol, setEnteredAssetSymbol] = useState('');
  const [assetCollection, setAssetCollection] = useState<AssetsState>({
    list: [],
    sort: 'desc',
    pagination: PaginationInitialState
  });

  const { currency, changeCurrency } = useUser();

  const searchParams = useSearchParams();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['assets', assetCollection.sort, assetCollection.pagination],
    queryFn: () =>
      getAssets({
        sort: assetCollection.sort,
        page: assetCollection.pagination.page,
        limit: assetCollection.pagination.limit
      }),
    select: ({ data }) => {
      const totalBalance = data.assets.reduce(
        (acc, curr) => (acc += curr.balance),
        0
      );
      const assetsWithDominance = data.assets.map((a) => {
        a.dominance =
          totalBalance > 0
            ? formatNumber(a.balance / totalBalance, {
                style: 'percent',
                maximumFractionDigits: 2
              })
            : '0%';
        return a;
      });
      return {
        totalBalance,
        sort: data.sort.order,
        pagination: data.pagination,
        assets: assetsWithDominance
      };
    },
    staleTime: 60_000
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

  const handleChangeRowsLimit = (v: string) =>
    setAssetCollection((state) => ({
      ...state,
      pagination: {
        ...state.pagination,
        limit: +v
      }
    }));

  const handleChangePage = (v: string) =>
    setAssetCollection((state) => ({
      ...state,
      pagination: {
        ...state.pagination,
        page: +v
      }
    }));

  const handleChangeCurrency = (v: string) =>
    changeCurrency(v as keyof typeof CURRENCIES);

  const handleOnAction = useCallback(
    (type: ActionType, payload?: Asset) => {
      onAction(type, payload);
      if (type === 'add-transaction') setIsAssetSelectionActive(false);
    },
    [onAction]
  );

  const handleChangeActiveAssetSelection = () => {
    setIsAssetSelectionActive((prev) => !prev);
    if (selectedAsset) setSelectedAsset(null);
  };

  useEffect(() => {
    if (!data) return;
    const { sort, pagination, assets } = data;

    setAssetCollection((state) => ({
      ...state,
      sort,
      pagination,
      list: enteredAssetSymbol
        ? assets.filter(({ symbol }) =>
            symbol.includes(enteredAssetSymbol.toUpperCase())
          )
        : assets
    }));
  }, [data, enteredAssetSymbol]);

  useEffect(() => {
    if (revalidate) refetch();
  }, [revalidate, refetch]);

  useEffect(() => {
    if (!data?.assets?.length) return;

    const assetSymbol = searchParams.get('symbol');
    const dialogCtxRef = searchParams.get('ref');
    if (!assetSymbol || !dialogCtxRef) return;

    handleOnAction(
      dialogCtxRef as ActionType,
      { symbol: assetSymbol } as Asset
    );
  }, [data, searchParams, handleOnAction]);

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
          <div className="flex items-center sm:gap-2">
            <Button
              variant="outline"
              aria-label="Refresh"
              className="h-8 sm:self-end"
              disabled={isLoading || isRefetching}
              onClick={() => refetch()}
            >
              <div className="flex items-center gap-2">
                <RefreshCw
                  size={16}
                  className={isRefetching ? 'animate-spin' : ''}
                />

                <span>Refresh</span>
              </div>
            </Button>

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

            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {(isLoading || isRefetching) &&
            Array.from({ length: assetCollection.pagination.limit }).map(
              (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8} align="center" className="p-3">
                    <Skeleton className="w-full h-7" />
                  </TableCell>
                </TableRow>
              )
            )}

          {!isLoading && !isRefetching && !assetCollection.list.length && (
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
            !isRefetching &&
            assetCollection.list?.map((asset, i) => (
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

        {!isLoading && !isRefetching && !!assetCollection.list.length && (
          <TableFooter>
            <TableRow className="hover:bg-gray-50">
              <TableCell className="px-3 py-1" colSpan={8}>
                <div className="flex">
                  <section className="w-1/2 flex justify-between">
                    <div className="w-fit flex items-center gap-1.5">
                      <span>Total</span>

                      <Select
                        disabled={isLoading}
                        defaultValue={currency}
                        onValueChange={handleChangeCurrency}
                      >
                        <SelectTrigger
                          aria-label="Currency"
                          className="w-fit h-7 sm:min-w-fit"
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
                        {formatNumber(data?.totalBalance ?? 0, {
                          minimumFractionDigits: 2
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Select
                        disabled={isLoading}
                        defaultValue={assetCollection.pagination.limit.toString()}
                        onValueChange={handleChangeRowsLimit}
                      >
                        <SelectTrigger
                          aria-label="Limit per page"
                          className="w-fit h-7 sm:min-w-fit"
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

                  {!enteredAssetSymbol.length && (
                    <section className="w-1/2">
                      <Pagination className="justify-end">
                        <PaginationContent className="hover:cursor-pointer">
                          <Button
                            variant="link"
                            className="p-0"
                            aria-label="Previous"
                            disabled={assetCollection.pagination.page === 1}
                          >
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() =>
                                  handleChangePage(
                                    String(assetCollection.pagination.page - 1)
                                  )
                                }
                              />
                            </PaginationItem>
                          </Button>
                          {Array.from({
                            length: assetCollection.pagination.totalPages
                          }).map((_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                aria-label={`Page ${i + 1}`}
                                isActive={
                                  assetCollection.pagination.page === i + 1
                                }
                                onClick={() => handleChangePage(String(i + 1))}
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
                              assetCollection.pagination.page ===
                              assetCollection.pagination.totalPages
                            }
                          >
                            <PaginationItem>
                              <PaginationNext
                                onClick={() =>
                                  handleChangePage(
                                    String(assetCollection.pagination.page + 1)
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
