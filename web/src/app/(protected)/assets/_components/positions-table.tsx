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
  ArrowUp,
  ArrowUpDown,
  Ellipsis,
  RefreshCw,
  Search,
  type LucideIcon
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

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
  NoResultsState
} from '@/components/data-state';
import {
  Money,
  Percentage,
  Price,
  ProfitLoss,
  Quantity,
  Trend
} from '@/components/financial';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import { usePositions, useRefreshPortfolio } from '@/hooks/use-portfolio';

type PositionsTableProps = Record<'portfolio', Portfolio> &
  Record<'onAddAsset', VoidFunction> &
  Record<'onAddTransaction' | 'onDeleteAsset', (symbol: string) => void>;

type PositionListing = Required<
  Pick<PositionListingParams, 'page' | 'pageSize' | 'sortBy' | 'sortOrder'>
> &
  Pick<PositionListingParams, 'search' | 'type' | 'status'>;

type PositionColumn = Record<'field', PositionSortField> &
  Record<'label', string>;

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
  open: 'Open',
  closed: 'Closed'
};

const POSITION_COLUMNS: Array<PositionColumn> = [
  { field: 'symbol', label: 'Asset' },
  { field: 'quantity', label: 'Quantity' },
  { field: 'averageCost', label: 'Average price' },
  { field: 'marketPrice', label: 'Price' },
  { field: 'marketValue', label: 'Value' },
  { field: 'allocation', label: 'Allocation' },
  { field: 'profitLoss', label: 'P&L' },
  { field: 'profitLossPercent', label: 'P&L %' }
];

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
    POSITION_COLUMNS.find(
      ({ field }) => field === params.get(LISTING_PARAMS.SortBy)
    )?.field ?? DEFAULT_SORT_FIELD;

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

  const { data, isError, isFetching, isPlaceholderData, refetch } =
    usePositions(portfolio, listing);
  const refreshPortfolio = useRefreshPortfolio(portfolio);

  const headingId = useId();
  const searchId = useId();
  const typeId = useId();
  const statusId = useId();
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

  const sortedColumn = POSITION_COLUMNS.find(
    ({ field }) => field === listing.sortBy
  );

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card className="shadow-none">
        <SectionHeader
          id={headingId}
          title="Positions"
          action={
            <Button
              variant="outline"
              className="h-9 gap-2 max-sm:w-full"
              disabled={isFetching}
              onClick={() => refreshPortfolio()}
            >
              <RefreshCw
                aria-hidden="true"
                className={twMerge(
                  'size-4',
                  isFetching && 'motion-safe:animate-spin'
                )}
              />
              Refresh
            </Button>
          }
        />

        <CardContent className="space-y-4">
          <div
            role="search"
            aria-label="Filter positions"
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <div className="grid gap-1.5">
              <Label htmlFor={searchId}>Search</Label>

              <Input
                ref={searchInputRef}
                id={searchId}
                type="search"
                placeholder="Symbol or name"
                maxLength={SEARCH_MAX_LENGTH}
                value={searchInput}
                onChange={({ target }) => setSearchInput(target.value)}
                className="h-9"
                leftElement={
                  <Search
                    aria-hidden="true"
                    size={16}
                    className="text-muted-foreground"
                  />
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={typeId}>Class</Label>

              <Select
                value={listing.type ?? ALL_OPTION}
                onValueChange={(value) =>
                  refine({
                    type: INSTRUMENT_TYPES.find((type) => type === value)
                  })
                }
              >
                <SelectTrigger id={typeId} className="h-9 sm:w-40">
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
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={statusId}>Status</Label>

              <Select
                value={listing.status ?? ALL_OPTION}
                onValueChange={(value) =>
                  refine({
                    status: POSITION_STATUSES.find((status) => status === value)
                  })
                }
              >
                <SelectTrigger id={statusId} className="h-9 sm:w-40">
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
            </div>
          </div>

          <div aria-busy={isLoading || isPlaceholderData} className="space-y-4">
            {isLoading && (
              <LoadingState
                label="Loading positions"
                className="h-64 rounded-none"
              />
            )}

            {data === undefined && isError && (
              <ErrorState
                message="The positions could not be loaded"
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
                className={twMerge(
                  'transition-opacity',
                  isPlaceholderData && 'opacity-60'
                )}
              >
                <TableCaption className="sr-only">
                  {`Positions valued in ${portfolio.baseCurrency}, sorted by ${sortedColumn?.label ?? listing.sortBy}, ${ARIA_SORT[listing.sortOrder]}`}
                </TableCaption>

                <TableHeader>
                  <TableRow>
                    {POSITION_COLUMNS.map(({ field, label }) => {
                      const isSorted = field === listing.sortBy;
                      const SortIcon = isSorted
                        ? SORT_ICONS[listing.sortOrder]
                        : ArrowUpDown;

                      return (
                        <TableHead
                          key={field}
                          aria-sort={
                            isSorted ? ARIA_SORT[listing.sortOrder] : undefined
                          }
                          className={twMerge(
                            'whitespace-nowrap',
                            field !== 'symbol' && 'text-right'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => sortBy(field)}
                            className={twMerge(
                              'inline-flex items-center gap-1 rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                              isSorted && 'text-foreground'
                            )}
                          >
                            {label}

                            <SortIcon
                              aria-hidden="true"
                              className={twMerge(
                                'size-3.5',
                                !isSorted && 'opacity-40'
                              )}
                            />
                          </button>
                        </TableHead>
                      );
                    })}

                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {data.items.map((position) => (
                    <TableRow key={position.symbol}>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          <Button
                            asChild
                            variant="link"
                            className="h-auto p-0 font-medium"
                          >
                            <Link href={assetDetailRoute(position.symbol)}>
                              {position.symbol}
                            </Link>
                          </Button>

                          <span className="text-xs text-muted-foreground">
                            {position.name}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <Quantity value={position.quantity} />
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-right">
                        <Price
                          value={position.averageCost}
                          currency={position.baseCurrency}
                        />
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-right">
                        <Price
                          value={position.marketPrice}
                          currency={position.baseCurrency}
                        />
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-right font-medium">
                        <Money
                          value={position.marketValue}
                          currency={position.baseCurrency}
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <Percentage value={position.allocation} />
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-right">
                        <ProfitLoss
                          value={position.profitLoss}
                          currency={position.baseCurrency}
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <Trend value={position.profitLossPercent} />
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

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => onAddTransaction(position.symbol)}
                            >
                              New transaction
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="text-negative focus:text-negative"
                              onSelect={() => onDeleteAsset(position.symbol)}
                            >
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

                <nav
                  aria-label="Positions pages"
                  className="flex items-center justify-between gap-3"
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={data.page <= FIRST_PAGE}
                    onClick={() => refine({ page: data.page - 1 })}
                  >
                    Previous
                  </Button>

                  <span
                    aria-live="polite"
                    className="text-sm text-muted-foreground"
                  >
                    {`Page ${data.page} of ${data.totalPages} · ${data.total} ${data.total === 1 ? 'position' : 'positions'}`}
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={data.page >= data.totalPages}
                    onClick={() => refine({ page: data.page + 1 })}
                  >
                    Next
                  </Button>
                </nav>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
