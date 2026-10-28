'use client';

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
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Plus,
  Search,
  X
} from 'lucide-react';

import type {
  Expense,
  ExpenseCategory,
  ExpenseKind,
  ExpenseSortField,
  ExpenseStatusFilter,
  SortOrder
} from '@/app/api/v1/finances';
import {
  BILL_DETAIL_PARAM,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_KIND_LABELS,
  EXPENSE_KINDS,
  EXPENSE_STATUS_FILTER_LABELS,
  EXPENSE_STATUS_FILTERS,
  FINANCE_LIMITS
} from '@/common/constants';
import { formatMoney, updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  STALE_DATA_MESSAGE,
  StaleState
} from '@/components/data-state';
import { DatePicker } from '@/components/date-picker';
import { Money } from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
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
import {
  useCreateExpense,
  useExpenses,
  useFinanceAlerts,
  useReferenceDay
} from '@/hooks/use-finances';
import { isCalendarDay } from '@/lib/dates';
import {
  DECIMAL_COLUMN,
  isNonzeroDecimal,
  readDecimal,
  unitsOf
} from '@/lib/decimal';
import { FIRST_PAGE, pageNumberFrom } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import { BillDialogs } from './bill-dialogs';
import { ExpenseFormDialog } from './expense-form-dialog';
import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  isOpenExpense,
  originLabelOf
} from './finance-display';
import { AlertTotals } from './finance-summary';

type BillListing = Record<'page', number> &
  Record<'sortBy', ExpenseSortField> &
  Record<'sortOrder', SortOrder> &
  Partial<Record<'search' | 'currency', string>> &
  Partial<Record<'status', ExpenseStatusFilter>> &
  Partial<Record<'kind', ExpenseKind>> &
  Partial<Record<'category', ExpenseCategory>> &
  Partial<Record<'dueFrom' | 'dueTo' | 'minAmount' | 'maxAmount', string>>;

type Refine = (refinement: Partial<BillListing>) => void;

type AmountFilterProps = Record<'label', string> &
  Record<'value', string | undefined> &
  Record<'onCommit', (value: string | undefined) => void>;

const PAGE_SIZE = 20;
const DEFAULT_SORT_FIELD: ExpenseSortField = 'dueDate';
const SEARCH_DEBOUNCE_MS = 300;
const ALL_OPTION = 'all';
const ACTIVE_FILTER_CLASS = 'border-primary/50 bg-primary/5 text-foreground';

const LISTING_PARAMS = {
  Page: 'page',
  SortBy: 'sortBy',
  SortOrder: 'sortOrder',
  Search: 'search',
  Status: 'status',
  Kind: 'kind',
  Category: 'category',
  Currency: 'currency',
  DueFrom: 'dueFrom',
  DueTo: 'dueTo',
  MinAmount: 'minAmount',
  MaxAmount: 'maxAmount'
} as const;

const SORT_FIELDS: Array<ExpenseSortField> = [
  'dueDate',
  'amount',
  'description',
  'createdAt'
];

const SORT_FIELD_LABELS: Record<ExpenseSortField, string> = {
  dueDate: 'Due date',
  amount: 'Amount',
  description: 'Description',
  createdAt: 'Date added'
};

const SORT_ORDERS: Array<SortOrder> = ['asc', 'desc'];

const REVERSED_ORDER: Record<SortOrder, SortOrder> = {
  asc: 'desc',
  desc: 'asc'
};

const ARIA_SORT: Record<SortOrder, string> = {
  asc: 'ascending',
  desc: 'descending'
};

const firstOrderOf = (field: ExpenseSortField): SortOrder =>
  field === 'dueDate' || field === 'description' ? 'asc' : 'desc';

const SKELETON_ROWS = Array.from({ length: 8 }, (_, row) => row);

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const COLUMN_VISIBILITY = {
  due: 'max-md:hidden',
  status: 'max-sm:hidden'
} as const;

const dayParamOf = (value: string | null) =>
  value !== null && isCalendarDay(value) ? value : undefined;

const amountParamOf = (value: string | null) => {
  if (value === null) return undefined;

  const reading = readDecimal(value);

  return reading.outcome === 'read' ? reading.value : undefined;
};

const listingFrom = (params: URLSearchParams): BillListing => {
  const sortBy =
    SORT_FIELDS.find((field) => field === params.get(LISTING_PARAMS.SortBy)) ??
    DEFAULT_SORT_FIELD;

  const search = params
    .get(LISTING_PARAMS.Search)
    ?.trim()
    .slice(0, FINANCE_LIMITS.SearchMaxLength);

  const currency = params.get(LISTING_PARAMS.Currency)?.toUpperCase();

  return {
    page: pageNumberFrom(params.get(LISTING_PARAMS.Page)),
    sortBy,
    sortOrder:
      SORT_ORDERS.find(
        (order) => order === params.get(LISTING_PARAMS.SortOrder)
      ) ?? firstOrderOf(sortBy),
    search: search || undefined,
    status: EXPENSE_STATUS_FILTERS.find(
      (status) => status === params.get(LISTING_PARAMS.Status)
    ),
    kind: EXPENSE_KINDS.find(
      (kind) => kind === params.get(LISTING_PARAMS.Kind)
    ),
    category: EXPENSE_CATEGORIES.find(
      (category) => category === params.get(LISTING_PARAMS.Category)
    ),
    currency:
      currency !== undefined && CURRENCY_PATTERN.test(currency)
        ? currency
        : undefined,
    dueFrom: dayParamOf(params.get(LISTING_PARAMS.DueFrom)),
    dueTo: dayParamOf(params.get(LISTING_PARAMS.DueTo)),
    minAmount: amountParamOf(params.get(LISTING_PARAMS.MinAmount)),
    maxAmount: amountParamOf(params.get(LISTING_PARAMS.MaxAmount))
  };
};

const writeParam = (
  params: URLSearchParams,
  name: string,
  value: string | undefined
) => (value === undefined ? params.delete(name) : params.set(name, value));

const paramsFor = (current: URLSearchParams, listing: BillListing) => {
  const params = new URLSearchParams(current);
  const hasDefaultSort =
    listing.sortBy === DEFAULT_SORT_FIELD &&
    listing.sortOrder === firstOrderOf(DEFAULT_SORT_FIELD);

  writeParam(
    params,
    LISTING_PARAMS.Page,
    listing.page === FIRST_PAGE ? undefined : String(listing.page)
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
  writeParam(params, LISTING_PARAMS.Status, listing.status);
  writeParam(params, LISTING_PARAMS.Kind, listing.kind);
  writeParam(params, LISTING_PARAMS.Category, listing.category);
  writeParam(params, LISTING_PARAMS.Currency, listing.currency);
  writeParam(params, LISTING_PARAMS.DueFrom, listing.dueFrom);
  writeParam(params, LISTING_PARAMS.DueTo, listing.dueTo);
  writeParam(params, LISTING_PARAMS.MinAmount, listing.minAmount);
  writeParam(params, LISTING_PARAMS.MaxAmount, listing.maxAmount);

  return params;
};

const NO_REFINEMENT: Partial<BillListing> = {
  search: undefined,
  status: undefined,
  kind: undefined,
  category: undefined,
  currency: undefined,
  dueFrom: undefined,
  dueTo: undefined,
  minAmount: undefined,
  maxAmount: undefined
};

const hasRefinementIn = (listing: BillListing) =>
  Object.keys(NO_REFINEMENT).some(
    (key) => listing[key as keyof BillListing] !== undefined
  );

const unitsOfAmount = (amount: string) => unitsOf(amount, DECIMAL_COLUMN.SCALE);

/** A range given backwards still means the span between its ends. */
const orderedRange = (
  from: string | undefined,
  to: string | undefined,
  isAfter: (from: string, to: string) => boolean
) =>
  from !== undefined && to !== undefined && isAfter(from, to)
    ? { from: to, to: from }
    : { from, to };

const AmountFilter: FC<AmountFilterProps> = ({ label, value, onCommit }) => {
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState(value ?? '');
  const [isInvalid, setIsInvalid] = useState(false);

  useEffect(() => {
    setText(value ?? '');
    setIsInvalid(false);
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();

    if (trimmed === '') {
      setIsInvalid(false);
      if (value !== undefined) onCommit(undefined);

      return;
    }

    const reading = readDecimal(trimmed);

    if (reading.outcome !== 'read') {
      setIsInvalid(true);

      return;
    }

    setIsInvalid(false);
    if (reading.value !== value) onCommit(reading.value);
  };

  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {label}
      </Label>

      <Input
        id={inputId}
        inputMode="decimal"
        autoComplete="off"
        placeholder="Any"
        value={text}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
        className={cn('h-9', value !== undefined && ACTIVE_FILTER_CLASS)}
        onChange={({ target }) => setText(target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />

      {isInvalid && (
        <p id={errorId} className="text-xs text-negative">
          Enter an amount such as 150 or 150.50
        </p>
      )}
    </div>
  );
};

const DayFilter: FC<
  Record<'label', string> &
    Record<'value', string | undefined> &
    Record<'onChange', (value: string | undefined) => void>
> = ({ label, value, onChange }) => {
  const pickerId = useId();

  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={pickerId} className="text-xs text-muted-foreground">
        {label}
      </Label>

      <div className="flex gap-1">
        <div
          className={cn(
            'min-w-0 flex-1 [&_button]:h-9',
            value !== undefined && '[&_button]:border-primary/50'
          )}
        >
          <DatePicker
            id={pickerId}
            value={value ?? ''}
            onValueChange={(day) => onChange(day)}
          />
        </div>

        {value !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const BillFilters: FC<
  Record<'listing', BillListing> &
    Record<'refine', Refine> &
    Record<'onClear', VoidFunction>
> = ({ listing, refine, onClear }) => {
  const statusId = useId();
  const kindId = useId();
  const categoryId = useId();
  const sortId = useId();
  const hasRefinement = hasRefinementIn(listing);
  const SortOrderIcon =
    listing.sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={statusId} className="text-xs text-muted-foreground">
            Status
          </Label>

          <Select
            value={listing.status ?? ALL_OPTION}
            onValueChange={(value) =>
              refine({
                status: EXPENSE_STATUS_FILTERS.find(
                  (status) => status === value
                )
              })
            }
          >
            <SelectTrigger
              id={statusId}
              className={cn(
                'h-9',
                listing.status !== undefined && ACTIVE_FILTER_CLASS
              )}
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={ALL_OPTION}>All statuses</SelectItem>

              {EXPENSE_STATUS_FILTERS.map((status) => (
                <SelectItem key={status} value={status}>
                  {EXPENSE_STATUS_FILTER_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={kindId} className="text-xs text-muted-foreground">
            Type
          </Label>

          <Select
            value={listing.kind ?? ALL_OPTION}
            onValueChange={(value) =>
              refine({ kind: EXPENSE_KINDS.find((kind) => kind === value) })
            }
          >
            <SelectTrigger
              id={kindId}
              className={cn(
                'h-9',
                listing.kind !== undefined && ACTIVE_FILTER_CLASS
              )}
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={ALL_OPTION}>All types</SelectItem>

              {EXPENSE_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {EXPENSE_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor={categoryId} className="text-xs text-muted-foreground">
            Category
          </Label>

          <Select
            value={listing.category ?? ALL_OPTION}
            onValueChange={(value) =>
              refine({
                category: EXPENSE_CATEGORIES.find(
                  (category) => category === value
                )
              })
            }
          >
            <SelectTrigger
              id={categoryId}
              className={cn(
                'h-9',
                listing.category !== undefined && ACTIVE_FILTER_CLASS
              )}
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={ALL_OPTION}>All categories</SelectItem>

              {EXPENSE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <DayFilter
          label="Due from"
          value={listing.dueFrom}
          onChange={(dueFrom) => refine({ dueFrom })}
        />

        <DayFilter
          label="Due to"
          value={listing.dueTo}
          onChange={(dueTo) => refine({ dueTo })}
        />

        <AmountFilter
          label="Minimum amount"
          value={listing.minAmount}
          onCommit={(minAmount) => refine({ minAmount })}
        />

        <AmountFilter
          label="Maximum amount"
          value={listing.maxAmount}
          onCommit={(maxAmount) => refine({ maxAmount })}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {listing.currency !== undefined && (
            <Button
              variant="outline"
              size="sm"
              className={cn('h-8 gap-1.5', ACTIVE_FILTER_CLASS)}
              onClick={() => refine({ currency: undefined })}
            >
              {`Only ${listing.currency}`}

              <X aria-hidden="true" className="size-3.5" />

              <span className="sr-only">, remove this filter</span>
            </Button>
          )}

          {hasRefinement && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={onClear}
            >
              <X aria-hidden="true" className="size-4" />
              Clear filters
            </Button>
          )}
        </div>

        <div
          role="group"
          aria-label="Sort bills"
          className="flex items-center gap-2 max-sm:w-full"
        >
          <Label htmlFor={sortId} className="sr-only">
            Sort by
          </Label>

          <Select
            value={listing.sortBy}
            onValueChange={(value) => {
              const field = SORT_FIELDS.find(
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
              {SORT_FIELDS.map((field) => (
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
    </div>
  );
};

const BillAmount: FC<Record<'expense', Expense>> = ({ expense }) => {
  const { amount, outstandingAmount, settledAmount, currency } = expense;
  const isPartlySettled =
    isOpenExpense(expense) && isNonzeroDecimal(settledAmount);

  return (
    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
      <span className="font-medium">
        <Money value={amount} currency={currency} />
      </span>

      {isPartlySettled && (
        <span className="text-xs text-muted-foreground">
          {`${formatMoney(outstandingAmount, currency)} left`}
        </span>
      )}
    </div>
  );
};

const BillRow: FC<
  Record<'expense', Expense> & Record<'href', string> & Record<'today', string>
> = ({ expense, href, today }) => {
  const { description, category, dueDate, status } = expense;
  const dueDistance = isOpenExpense(expense)
    ? dueDistanceOf(dueDate, today)
    : null;

  return (
    <TableRow>
      <TableRowHeader className="relative py-3">
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Link
            href={href}
            scroll={false}
            className="line-clamp-2 rounded-sm font-semibold ring-offset-background wrap-anywhere after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            {description}
          </Link>

          <span className="text-xs text-muted-foreground">
            {`${originLabelOf(expense)} · ${EXPENSE_CATEGORY_LABELS[category]}`}
          </span>

          <span className="text-xs text-muted-foreground md:hidden">
            {'Due '}

            <CalendarDayText day={dueDate} />
          </span>

          <ExpenseStatusBadge status={status} className="mt-1 sm:hidden" />
        </div>
      </TableRowHeader>

      <TableCell className={cn('whitespace-nowrap', COLUMN_VISIBILITY.due)}>
        <div className="flex flex-col gap-0.5">
          <CalendarDayText day={dueDate} />

          {dueDistance !== null && (
            <span
              className={cn(
                'text-xs',
                status === 'OVERDUE' ? 'text-negative' : 'text-muted-foreground'
              )}
            >
              {dueDistance}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right tabular-nums">
        <BillAmount expense={expense} />
      </TableCell>

      <TableCell className={cn('text-right', COLUMN_VISIBILITY.status)}>
        <ExpenseStatusBadge status={status} />
      </TableCell>
    </TableRow>
  );
};

const AlertsStrip: FC = () => {
  const { data } = useFinanceAlerts();

  if (data === undefined) return null;

  const { overdue, dueSoon, reminders } = data;
  const { reminderLeadDays } = reminders;

  if (overdue.count === 0 && dueSoon.count === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {overdue.count > 0 && (
        <AlertTotals
          tone="negative"
          title={`${overdue.count} overdue ${overdue.count === 1 ? 'bill' : 'bills'}`}
          totals={overdue.totals}
        />
      )}

      {dueSoon.count > 0 && (
        <AlertTotals
          tone="warning"
          title={`${dueSoon.count} due ${reminderLeadDays === 0 ? 'today' : `within ${reminderLeadDays} ${reminderLeadDays === 1 ? 'day' : 'days'}`}`}
          totals={dueSoon.totals}
        />
      )}
    </div>
  );
};

export const BillsView: FC = () => {
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const listing = useMemo(() => listingFrom(searchParams), [searchParams]);
  const openBillId = searchParams.get(BILL_DETAIL_PARAM);

  const [isAdding, setIsAdding] = useState(false);
  const [searchInput, setSearchInput] = useState(() => listing.search ?? '');
  const committedSearch = useRef(listing.search);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const searchId = useId();

  const { mutateAsync: createExpense } = useCreateExpense();

  const dueRange = orderedRange(
    listing.dueFrom,
    listing.dueTo,
    (from, to) => from > to
  );
  const amountRange = orderedRange(
    listing.minAmount,
    listing.maxAmount,
    (from, to) => unitsOfAmount(from) > unitsOfAmount(to)
  );

  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useExpenses({
    page: listing.page,
    pageSize: PAGE_SIZE,
    sortBy: listing.sortBy,
    sortOrder: listing.sortOrder,
    search: listing.search,
    status: listing.status,
    kind: listing.kind,
    category: listing.category,
    currency: listing.currency,
    dueFrom: dueRange.from,
    dueTo: dueRange.to,
    minAmount: amountRange.from,
    maxAmount: amountRange.to
  });

  const searchTerm = searchInput.trim();
  const isLoading = data === undefined && !isError;
  const hasRefinement = hasRefinementIn(listing);

  const refine = useCallback<Refine>(
    (refinement) =>
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

  const clearRefinements = () => {
    setSearchInput('');
    refine(NO_REFINEMENT);
    searchInputRef.current?.focus();
  };

  const billHref = (expenseId: string) => {
    const params = new URLSearchParams(searchParams);

    params.set(BILL_DETAIL_PARAM, expenseId);

    return `?${params}`;
  };

  const closeBill = () => {
    const params = new URLSearchParams(searchParams);

    params.delete(BILL_DETAIL_PARAM);
    updateUrlQuery(params);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        description="Everything owed, paid or cancelled: one-time bills, installments and recurring expenses"
        action={
          <Button
            size="sm"
            className="gap-1.5 max-sm:w-full"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Add bill
          </Button>
        }
      />

      <AlertsStrip />

      <section aria-labelledby={headingId} className="min-w-0">
        <Card>
          <SectionHeader id={headingId} title="All bills" />

          <CardContent className="space-y-4">
            <div role="search" aria-label="Filter bills" className="space-y-3">
              <Label htmlFor={searchId} className="sr-only">
                Search
              </Label>

              <Input
                ref={searchInputRef}
                id={searchId}
                type="search"
                placeholder="Search description, notes or account"
                maxLength={FINANCE_LIMITS.SearchMaxLength}
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

              <BillFilters
                listing={listing}
                refine={refine}
                onClear={clearRefinements}
              />
            </div>

            <div
              aria-busy={isLoading || isPlaceholderData}
              className="space-y-4"
            >
              {isLoading && (
                <LoadingState label="Loading bills">
                  <div aria-hidden="true" className="divide-y border-b">
                    {SKELETON_ROWS.map((row) => (
                      <div
                        key={row}
                        className="flex items-center gap-4 px-2 py-3"
                      >
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-40" />

                          <Skeleton className="h-3 w-28" />
                        </div>

                        <Skeleton
                          className={cn('h-4 w-24', COLUMN_VISIBILITY.due)}
                        />

                        <Skeleton className="h-4 w-20" />

                        <Skeleton
                          className={cn(
                            'h-5 w-16 rounded-full',
                            COLUMN_VISIBILITY.status
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </LoadingState>
              )}

              {data === undefined && isError && (
                <ErrorState
                  message="The bills could not be loaded"
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
                  message="No bills yet"
                  action={{
                    label: 'Add bill',
                    onSelect: () => setIsAdding(true)
                  }}
                />
              )}

              {data?.total === 0 && hasRefinement && (
                <NoResultsState
                  message="No bills match the search and filters"
                  onClear={clearRefinements}
                />
              )}

              {data !== undefined &&
                data.total > 0 &&
                data.items.length === 0 && (
                  <EmptyState
                    message={`No bills on page ${data.page}`}
                    action={{
                      label: `Go to page ${data.totalPages}`,
                      onSelect: () => refine({ page: data.totalPages })
                    }}
                  />
                )}

              {data !== undefined && data.items.length > 0 && (
                <Table
                  label="Bills table"
                  className={cn(
                    'transition-opacity',
                    isPlaceholderData && 'opacity-60'
                  )}
                >
                  <TableCaption className="sr-only">
                    {`Bills sorted by ${SORT_FIELD_LABELS[listing.sortBy]}, ${ARIA_SORT[listing.sortOrder]}`}
                  </TableCaption>

                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Bill</TableHead>

                      <TableHead className={COLUMN_VISIBILITY.due}>
                        Due
                      </TableHead>

                      <TableHead className="text-right">Amount</TableHead>

                      <TableHead
                        className={cn('text-right', COLUMN_VISIBILITY.status)}
                      >
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {data.items.map((expense) => (
                      <BillRow
                        key={expense.id}
                        expense={expense}
                        href={billHref(expense.id)}
                        today={today}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}

              {data !== undefined && data.total > 0 && (
                <div className="flex justify-end">
                  <PageNavigation
                    label="Bills pages"
                    page={data.page}
                    totalPages={data.totalPages}
                    detail={`${data.total} ${data.total === 1 ? 'bill' : 'bills'}`}
                    onPageChange={(page) => refine({ page })}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <BillDialogs expenseId={openBillId} onClose={closeBill} />

      {isAdding && (
        <ExpenseFormDialog
          target={{ kind: 'create' }}
          onCancel={() => setIsAdding(false)}
          onSubmit={async (draft) => {
            await createExpense(draft);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
};
