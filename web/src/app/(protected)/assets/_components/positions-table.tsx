import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC
} from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpDown,
  ArrowUpNarrowWide,
  ArrowUpRight,
  Ellipsis,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  type LucideIcon
} from 'lucide-react';

import type {
  PositionListingParams,
  PositionSortField,
  PositionStatus,
  SortOrder
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import {
  assetDetailRoute,
  INSTRUMENT_TYPE_LABELS,
  INSTRUMENT_TYPES
} from '@/common/constants';
import { updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  STALE_DATA_MESSAGE,
  StaleState
} from '@/components/data-state';
import {
  Money,
  Percentage,
  Price,
  ProfitLoss,
  Quantity
} from '@/components/financial';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import { usePositions, useRefreshPortfolio } from '@/hooks/use-portfolio';
import { cn } from '@/lib/utils';

type PositionsTableProps = Record<'portfolio', Portfolio> &
  Record<'onAddAsset', VoidFunction> &
  Record<'onAddTransaction' | 'onDeleteAsset', (symbol: string) => void>;

type PositionListing = Required<
  Pick<PositionListingParams, 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>
> &
  Pick<PositionListingParams, 'search' | 'type' | 'status'>;

type PositionColumn = Record<'field', PositionSortField> &
  Record<'label' | 'className', string>;

const FIRST_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [DEFAULT_PAGE_SIZE, 25, 50];
const DEFAULT_SORT_FIELD: PositionSortField = 'symbol';

const LISTING_PARAMS = {
  Page: 'page',
  PageSize: 'pageSize',
  SortBy: 'sortBy',
  SortOrder: 'sortOrder',
  Search: 'search',
  Type: 'type',
  Status: 'status'
} as const;

/** The API rejects a longer search, and no instrument name is longer. */
const SEARCH_MAX_LENGTH = 120;

/** Requests a search once typing pauses, not once per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;

const ALL_OPTION = 'all';

const POSITION_STATUSES: Array<PositionStatus> = ['open', 'closed'];

const POSITION_STATUS_LABELS: Record<PositionStatus, string> = {
  open: 'Open positions',
  closed: 'Closed positions'
};

const POSITION_SORT_FIELDS: Array<PositionSortField> = [
  'symbol',
  'quantity',
  'averageCost',
  'marketPrice',
  'marketValue',
  'allocation',
  'profitLoss',
  'profitLossPercent'
];

const SORT_FIELD_LABELS: Record<PositionSortField, string> = {
  symbol: 'Symbol',
  quantity: 'Quantity',
  averageCost: 'Average cost',
  marketPrice: 'Price',
  marketValue: 'Value',
  allocation: 'Allocation',
  profitLoss: 'Profit/Loss',
  profitLossPercent: 'Profit/Loss %'
};

/**
 * Columns leave from the widest breakpoint down, so a phone keeps the asset,
 * its value and, under the name, its profit or loss; the asset detail page
 * keeps every hidden number.
 */
const COLUMN_VISIBILITY = {
  price: 'max-lg:hidden',
  allocation: 'max-md:hidden',
  profitLoss: 'max-sm:hidden'
} as const;

/**
 * Each column pairs a figure with the one read under it and sorts by the
 * first; the sort control reaches every field.
 */
const POSITION_COLUMNS: Array<PositionColumn> = [
  { field: 'symbol', label: 'Asset', className: '' },
  { field: 'marketPrice', label: 'Price', className: COLUMN_VISIBILITY.price },
  { field: 'marketValue', label: 'Value', className: '' },
  {
    field: 'allocation',
    label: 'Allocation',
    className: COLUMN_VISIBILITY.allocation
  },
  {
    field: 'profitLoss',
    label: 'Profit/Loss',
    className: COLUMN_VISIBILITY.profitLoss
  }
];

/** The first page holds this many rows, so its skeleton does too. */
const SKELETON_ROWS = Array.from(
  { length: DEFAULT_PAGE_SIZE },
  (_, row) => row
);

const ACTIVE_FILTER_CLASS = 'border-primary/50 bg-primary/5 text-foreground';

const REVERSED_ORDER: Record<SortOrder, SortOrder> = {
  asc: 'desc',
  desc: 'asc'
};

const ARIA_SORT: Record<SortOrder, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending'
};

const SORT_ICONS: Record<SortOrder, LucideIcon> = {
  asc: ArrowUp,
  desc: ArrowDown
};

const SORT_ORDERS: Array<SortOrder> = ['asc', 'desc'];

const firstOrderOf = (field: PositionSortField): SortOrder =>
  field === 'symbol' ? 'asc' : 'desc';

const DEFAULT_SORT_ORDER = firstOrderOf(DEFAULT_SORT_FIELD);

const pageFrom = (value: string | null) => {
  const page = Number(value);

  return Number.isInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE;
};

const listingFrom = (params: URLSearchParams): PositionListing => {
  const sortBy =
    POSITION_SORT_FIELDS.find(
      (field) => field === params.get(LISTING_PARAMS.SortBy)
    ) ?? DEFAULT_SORT_FIELD;

  const search = params
    .get(LISTING_PARAMS.Search)
    ?.trim()
    .slice(0, SEARCH_MAX_LENGTH);

  return {
    page: pageFrom(params.get(LISTING_PARAMS.Page)),
    pageSize:
      PAGE_SIZES.find(
        (size) => String(size) === params.get(LISTING_PARAMS.PageSize)
      ) ?? DEFAULT_PAGE_SIZE,
    sortBy,
    sortOrder:
      SORT_ORDERS.find(
        (order) => order === params.get(LISTING_PARAMS.SortOrder)
      ) ?? firstOrderOf(sortBy),
    search: search || undefined,
    type: INSTRUMENT_TYPES.find(
      (type) => type === params.get(LISTING_PARAMS.Type)
    ),
    status: POSITION_STATUSES.find(
      (status) => status === params.get(LISTING_PARAMS.Status)
    )
  };
};

const writeParam = (
  params: URLSearchParams,
  name: string,
  value: string | undefined
) => (value === undefined ? params.delete(name) : params.set(name, value));

const paramsFor = (current: URLSearchParams, listing: PositionListing) => {
  const params = new URLSearchParams(current);

  const hasDefaultSort =
    listing.sortBy === DEFAULT_SORT_FIELD &&
    listing.sortOrder === DEFAULT_SORT_ORDER;

  writeParam(
    params,
    LISTING_PARAMS.Page,
    listing.page === FIRST_PAGE ? undefined : String(listing.page)
  );
  writeParam(
    params,
    LISTING_PARAMS.PageSize,
    listing.pageSize === DEFAULT_PAGE_SIZE
      ? undefined
      : String(listing.pageSize)
  );
  writeParam(
    params,
    LISTING_PARAMS.SortBy,
    hasDefaultSort ? undefined : listing.sortBy
  );
  writeParam(
    params,
    LISTING_PARAMS.SortOrder,
    hasDefaultSort ? undefined : listing.sortOrder
  );
  writeParam(params, LISTING_PARAMS.Search, listing.search);
  writeParam(params, LISTING_PARAMS.Type, listing.type);
  writeParam(params, LISTING_PARAMS.Status, listing.status);

  return params;
};

export const PositionsTable: FC<PositionsTableProps> = ({
  portfolio,
  onAddAsset,
  onAddTransaction,
  onDeleteAsset
}) => {
  const searchParams = useSearchParams();
  const listing = useMemo(() => listingFrom(searchParams), [searchParams]);

  const [searchInput, setSearchInput] = useState(() => listing.search ?? '');
  const committedSearch = useRef(listing.search);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = usePositions(portfolio, listing);
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  const headingId = useId();
  const searchId = useId();
  const typeId = useId();
  const statusId = useId();
  const sortId = useId();
  const pageSizeId = useId();

  const searchTerm = searchInput.trim();
  const isLoading = data === undefined && !isError;
  const hasRefinement =
    listing.search !== undefined ||
    listing.type !== undefined ||
    listing.status !== undefined;

  const refine = useCallback(
    (refinement: Partial<PositionListing>) =>
      updateUrlQuery(
        paramsFor(searchParams, { ...listing, page: FIRST_PAGE, ...refinement })
      ),
    [listing, searchParams]
  );

  useEffect(() => {
    const search = searchTerm || undefined;

    if (search === listing.search) return;

    const timeout = setTimeout(() => {
      committedSearch.current = search;
      refine({ search });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchTerm, listing.search, refine]);

  useEffect(() => {
    if (listing.search === committedSearch.current) return;

    committedSearch.current = listing.search;
    setSearchInput(listing.search ?? '');
  }, [listing.search]);

  const sortBy = (field: PositionSortField) =>
    refine({
      sortBy: field,
      sortOrder:
        field === listing.sortBy
          ? REVERSED_ORDER[listing.sortOrder]
          : firstOrderOf(field)
    });

  const clearRefinements = () => {
    setSearchInput('');
    refine({ search: undefined, type: undefined, status: undefined });
    searchInputRef.current?.focus();
  };

  const SortOrderIcon =
    listing.sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  const tableHeader = (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {POSITION_COLUMNS.map(({ field, label, className }) => {
          const isSorted = field === listing.sortBy;
          const SortIcon = isSorted
            ? SORT_ICONS[listing.sortOrder]
            : ArrowUpDown;

          return (
            <TableHead
              key={field}
              aria-sort={isSorted ? ARIA_SORT[listing.sortOrder] : undefined}
              className={cn(
                'whitespace-nowrap',
                field !== 'symbol' && 'text-right',
                className
              )}
            >
              <button
                type="button"
                onClick={() => sortBy(field)}
                className={cn(
                  'group inline-flex items-center gap-1 rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                  isSorted && 'text-foreground'
                )}
              >
                {label}

                <SortIcon
                  aria-hidden="true"
                  className={cn(
                    'size-3.5 transition-opacity',
                    !isSorted &&
                      'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60'
                  )}
                />
              </button>
            </TableHead>
          );
        })}

        <TableHead className="w-10">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card>
        <SectionHeader
          id={headingId}
          title="Positions"
          action={
            <Button
              variant="outline"
              size="sm"
              className="gap-2 max-sm:w-full"
              aria-disabled={isFetching}
              onClick={() => {
                if (!isFetching) void refreshPortfolio();
              }}
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('size-4', isFetching && 'animate-spin')}
              />
              Refresh
            </Button>
          }
        />

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="search"
              aria-label="Filter positions"
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <Label htmlFor={searchId} className="sr-only">
                Search
              </Label>

              <Input
                ref={searchInputRef}
                id={searchId}
                type="search"
                placeholder="Search symbol or name"
                maxLength={SEARCH_MAX_LENGTH}
                value={searchInput}
                onChange={({ target }) => setSearchInput(target.value)}
                className="h-9 sm:w-64"
                leftElement={
                  <Search
                    aria-hidden="true"
                    size={16}
                    className="text-muted-foreground"
                  />
                }
              />

              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={typeId} className="sr-only">
                  Class
                </Label>

                <Select
                  value={listing.type ?? ALL_OPTION}
                  onValueChange={(value) =>
                    refine({
                      type: INSTRUMENT_TYPES.find((type) => type === value)
                    })
                  }
                >
                  <SelectTrigger
                    id={typeId}
                    className={cn(
                      'h-9 w-auto gap-2',
                      listing.type !== undefined && ACTIVE_FILTER_CLASS
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={ALL_OPTION}>All classes</SelectItem>

                    {INSTRUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {INSTRUMENT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label htmlFor={statusId} className="sr-only">
                  Status
                </Label>

                <Select
                  value={listing.status ?? ALL_OPTION}
                  onValueChange={(value) =>
                    refine({
                      status: POSITION_STATUSES.find(
                        (status) => status === value
                      )
                    })
                  }
                >
                  <SelectTrigger
                    id={statusId}
                    className={cn(
                      'h-9 w-auto gap-2',
                      listing.status !== undefined && ACTIVE_FILTER_CLASS
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={ALL_OPTION}>All positions</SelectItem>

                    {POSITION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {POSITION_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasRefinement && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 text-muted-foreground"
                    onClick={clearRefinements}
                  >
                    <X aria-hidden="true" className="size-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div
              role="group"
              aria-label="Sort positions"
              className="flex items-center gap-2"
            >
              <Label htmlFor={sortId} className="sr-only">
                Sort by
              </Label>

              <Select
                value={listing.sortBy}
                onValueChange={(value) => {
                  const field = POSITION_SORT_FIELDS.find(
                    (sortField) => sortField === value
                  );

                  if (field !== undefined)
                    refine({ sortBy: field, sortOrder: firstOrderOf(field) });
                }}
              >
                <SelectTrigger
                  id={sortId}
                  className="h-9 w-auto gap-1.5 max-sm:flex-1"
                >
                  <span aria-hidden="true" className="text-muted-foreground">
                    Sort by
                  </span>

                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {POSITION_SORT_FIELDS.map((field) => (
                    <SelectItem key={field} value={field}>
                      {SORT_FIELD_LABELS[field]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0"
                aria-label="Descending order"
                aria-pressed={listing.sortOrder === 'desc'}
                title="Descending order"
                onClick={() =>
                  refine({ sortOrder: REVERSED_ORDER[listing.sortOrder] })
                }
              >
                <SortOrderIcon aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>

          <div aria-busy={isLoading || isPlaceholderData} className="space-y-4">
            {isLoading && (
              <LoadingState label="Loading positions">
                <div aria-hidden="true" className="divide-y border-b">
                  {SKELETON_ROWS.map((row) => (
                    <div
                      key={row}
                      className="flex items-center gap-4 px-2 py-3"
                    >
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-16" />

                        <Skeleton className="h-3 w-32" />
                      </div>

                      <Skeleton
                        className={cn('h-4 w-20', COLUMN_VISIBILITY.price)}
                      />

                      <Skeleton className="h-4 w-24" />

                      <Skeleton
                        className={cn('h-4 w-12', COLUMN_VISIBILITY.allocation)}
                      />

                      <Skeleton
                        className={cn('h-4 w-20', COLUMN_VISIBILITY.profitLoss)}
                      />

                      <Skeleton className="size-8 rounded-md" />
                    </div>
                  ))}
                </div>
              </LoadingState>
            )}

            {data === undefined && isError && (
              <ErrorState
                message="The positions could not be loaded"
                onRetry={refetch}
              />
            )}

            {isRefetchError && (
              <StaleState
                message={STALE_DATA_MESSAGE}
                isRetrying={isFetching}
                onRetry={refetch}
              />
            )}

            {data?.total === 0 && !hasRefinement && (
              <EmptyState
                message="No positions yet"
                action={{ label: 'Add asset', onSelect: onAddAsset }}
              />
            )}

            {data?.total === 0 && hasRefinement && (
              <NoResultsState
                message="No positions match the search and filters"
                onClear={clearRefinements}
              />
            )}

            {data !== undefined &&
              data.total > 0 &&
              data.items.length === 0 && (
                <EmptyState
                  message={`No positions on page ${data.page}`}
                  action={{
                    label: `Go to page ${data.totalPages}`,
                    onSelect: () => refine({ page: data.totalPages })
                  }}
                />
              )}

            {data !== undefined && data.items.length > 0 && (
              <Table
                label="Positions table"
                className={cn(
                  'transition-opacity',
                  isPlaceholderData && 'opacity-60'
                )}
              >
                <TableCaption className="sr-only">
                  {`Positions valued in ${portfolio.baseCurrency}, sorted by ${SORT_FIELD_LABELS[listing.sortBy]}, ${ARIA_SORT[listing.sortOrder]}`}
                </TableCaption>

                {tableHeader}

                <TableBody>
                  {data.items.map((position) => (
                    <TableRow key={position.symbol}>
                      <TableRowHeader className="relative py-3">
                        <div className="flex min-w-0 flex-col items-start gap-0.5">
                          <Link
                            href={assetDetailRoute(position.symbol)}
                            className="rounded-sm font-semibold ring-offset-background after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                          >
                            {position.symbol}
                          </Link>

                          <span className="line-clamp-1 max-w-56 text-xs text-muted-foreground">
                            {position.name}
                          </span>

                          <span className="text-sm tabular-nums sm:hidden">
                            <ProfitLoss
                              value={position.profitLoss}
                              percent={position.profitLossPercent}
                              currency={position.baseCurrency}
                            />
                          </span>
                        </div>
                      </TableRowHeader>

                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          COLUMN_VISIBILITY.price
                        )}
                      >
                        <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                          <Price
                            value={position.marketPrice}
                            currency={position.baseCurrency}
                          />

                          <span className="text-xs text-muted-foreground">
                            {'Avg cost '}

                            <Price
                              value={position.averageCost}
                              currency={position.baseCurrency}
                            />
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                          <span className="font-medium">
                            <Money
                              value={position.marketValue}
                              currency={position.baseCurrency}
                            />
                          </span>

                          <span className="text-xs text-muted-foreground">
                            <Quantity value={position.quantity} />

                            {' held'}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell
                        className={cn(
                          'text-right tabular-nums',
                          COLUMN_VISIBILITY.allocation
                        )}
                      >
                        <Percentage value={position.allocation} />
                      </TableCell>

                      <TableCell
                        className={cn(
                          'whitespace-nowrap text-right tabular-nums',
                          COLUMN_VISIBILITY.profitLoss
                        )}
                      >
                        <ProfitLoss
                          value={position.profitLoss}
                          percent={position.profitLossPercent}
                          currency={position.baseCurrency}
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Actions for ${position.symbol}`}
                            >
                              <Ellipsis aria-hidden="true" className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild className="gap-2">
                              <Link href={assetDetailRoute(position.symbol)}>
                                <ArrowUpRight
                                  aria-hidden="true"
                                  className="size-4 text-muted-foreground"
                                />
                                View details
                              </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="gap-2"
                              onSelect={() => onAddTransaction(position.symbol)}
                            >
                              <Plus
                                aria-hidden="true"
                                className="size-4 text-muted-foreground"
                              />
                              New transaction
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="gap-2 text-destructive focus:text-destructive"
                              onSelect={() => onDeleteAsset(position.symbol)}
                            >
                              <Trash2 aria-hidden="true" className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {data !== undefined && data.total > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={pageSizeId}
                    className="text-sm font-normal text-muted-foreground"
                  >
                    Rows per page
                  </Label>

                  <Select
                    value={String(listing.pageSize)}
                    onValueChange={(value) =>
                      refine({
                        pageSize:
                          PAGE_SIZES.find((size) => String(size) === value) ??
                          DEFAULT_PAGE_SIZE
                      })
                    }
                  >
                    <SelectTrigger id={pageSizeId} className="h-9 w-20">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {PAGE_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <PageNavigation
                  label="Positions pages"
                  page={data.page}
                  totalPages={data.totalPages}
                  detail={`${data.total} ${data.total === 1 ? 'position' : 'positions'}`}
                  onPageChange={(page) => refine({ page })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
