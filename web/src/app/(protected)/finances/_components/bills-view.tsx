'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode
} from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { useTranslations } from 'use-intl';

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
  billsRouteFor,
  DEFAULT_CURRENCY,
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  EXPENSE_STATUS_FILTERS,
  FINANCE_LIMITS
} from '@/common/constants';
import { currencyFractionDigits, updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  StaleState
} from '@/components/data-state';
import { DatePicker } from '@/components/date-picker';
import { Money } from '@/components/financial';
import { MoneyInput } from '@/components/money-input';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  SearchableSelect,
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
  useExpenses,
  useFinanceAlerts,
  useRecordPayment,
  useReferenceDay
} from '@/hooks/use-finances';
import { useFormat, type Format } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import type { Translator } from '@/i18n/translator';
import { pastedAmountIssueOf } from '@/lib/amount-issues';
import { isCalendarDay, shiftCalendarDay } from '@/lib/dates';
import {
  compareDecimals,
  DECIMAL_COLUMN,
  decimalPlacesOf,
  isNonzeroDecimal,
  isStorableDecimal,
  unitsOf
} from '@/lib/decimal';
import { APPEAR_CLASS } from '@/lib/motion';
import { FIRST_PAGE, pageNumberFrom } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import type { DecimalString } from '@/types';

import { BillDialogs } from './bill-dialogs';
import { AddBillDialog } from './expense-form-dialog';
import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  isOpenExpense,
  originLabelOf
} from './finance-display';
import { AlertTotals } from './finance-summary';
import { PaymentFormDialog } from './payment-form-dialog';

type BillListing = Record<'page', number> &
  Record<'sortBy', ExpenseSortField> &
  Record<'sortOrder', SortOrder> &
  Partial<Record<'search' | 'currency', string>> &
  Partial<Record<'status', ExpenseStatusFilter>> &
  Partial<Record<'kind', ExpenseKind>> &
  Partial<Record<'category', ExpenseCategory>> &
  Partial<Record<'dueFrom' | 'dueTo', string>> &
  Partial<Record<'minAmount' | 'maxAmount', DecimalString>>;

type Refine = (refinement: Partial<BillListing>) => void;

type ActiveFilter = Record<'label', string> &
  Record<'refinement', Partial<BillListing>>;

type AmountLimit = Record<'side', 'min' | 'max'> &
  Record<'value', DecimalString>;

type AmountFilterProps = Record<'label', string> &
  Record<'value', DecimalString | undefined> &
  Record<'decimals', number> &
  Partial<Record<'limit', AmountLimit>> &
  Record<'onCommit', (value: DecimalString | undefined) => void>;

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

const SORT_ORDERS: Array<SortOrder> = ['asc', 'desc'];

const REVERSED_ORDER: Record<SortOrder, SortOrder> = {
  asc: 'desc',
  desc: 'asc'
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

/** The address holds the amount as the API takes it, never as a person types it. */
const amountParamOf = (value: string | null) =>
  value !== null && isStorableDecimal(value) ? value : undefined;

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

/** The filters the panel holds, counted on its toggle while it is closed. */
const PANEL_FILTERS = [
  'kind',
  'category',
  'dueFrom',
  'dueTo',
  'minAmount',
  'maxAmount'
] as const satisfies ReadonlyArray<keyof BillListing>;

const dayText = (day: string, { formatCalendarDay }: Format) =>
  formatCalendarDay(day) ?? day;

/** Each filter in force, in words, with what removes it; the search shows in its own field. */
const activeFiltersOf = (
  {
    status,
    kind,
    category,
    currency,
    dueFrom,
    dueTo,
    minAmount,
    maxAmount
  }: BillListing,
  t: Translator<'bills.filters.chips'>,
  tFinances: Translator<'finances'>,
  format: Format
): Array<ActiveFilter> =>
  [
    status === undefined
      ? null
      : {
          label: t('status', { value: tFinances(`statusFilters.${status}`) }),
          refinement: { status: undefined }
        },
    kind === undefined
      ? null
      : {
          label: t('kind', { value: tFinances(`kinds.${kind}`) }),
          refinement: { kind: undefined }
        },
    category === undefined
      ? null
      : {
          label: t('category', {
            value: tFinances(`categories.${category}`)
          }),
          refinement: { category: undefined }
        },
    currency === undefined
      ? null
      : {
          label: t('currency', { currency }),
          refinement: { currency: undefined }
        },
    dueFrom === undefined
      ? null
      : {
          label: t('dueFrom', { day: dayText(dueFrom, format) }),
          refinement: { dueFrom: undefined }
        },
    dueTo === undefined
      ? null
      : {
          label: t('dueTo', { day: dayText(dueTo, format) }),
          refinement: { dueTo: undefined }
        },
    minAmount === undefined
      ? null
      : {
          label: t('minAmount', {
            amount: format.formatQuantity(minAmount)
          }),
          refinement: { minAmount: undefined }
        },
    maxAmount === undefined
      ? null
      : {
          label: t('maxAmount', {
            amount: format.formatQuantity(maxAmount)
          }),
          refinement: { maxAmount: undefined }
        }
  ].filter((filter) => filter !== null);

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

/** Which bills of how many the page shows, such as "21–40 de 134 contas". */
const pageDetailOf = (
  {
    page,
    total,
    items
  }: Record<'page' | 'total', number> & Record<'items', ReadonlyArray<Expense>>,
  t: Translator<'bills'>
) => {
  if (items.length === 0) return t('count', { total });

  const first = (page - 1) * PAGE_SIZE + 1;

  return t('range', { first, last: first + items.length - 1, total });
};

/** Whether `value` passes `limit` on its side: above a maximum, below a minimum. */
const isPastLimit = (value: DecimalString, limit: AmountLimit | undefined) => {
  if (limit === undefined) return false;

  const order = compareDecimals(value, limit.value);

  return limit.side === 'max' ? order > 0 : order < 0;
};

/**
 * Digits enter as in the forms' amounts, from the right, and the amount
 * applies on leaving the field or on Enter, so typing it never refetches the
 * list halfway. An amount on the wrong side of the other bound stays unapplied.
 */
const AmountFilter: FC<AmountFilterProps> = ({
  label,
  value,
  decimals,
  limit,
  onCommit
}) => {
  const t = useTranslations('bills.filters');
  const tValidation = useTranslations('validation');
  const format = useFormat();
  const inputId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);

  const shown = draft ?? value ?? '';

  const edit = (typed: string) => {
    setDraft(typed);
    setIssue(null);
  };

  const commit = () => {
    if (draft === null) return;

    const next = isStorableDecimal(draft) ? draft : undefined;

    if (next !== undefined && isPastLimit(next, limit)) {
      setIssue(
        t(limit?.side === 'max' ? 'minAboveMax' : 'maxBelowMin', {
          amount: format.formatDecimal(
            limit?.value ?? '0',
            Math.max(decimals, decimalPlacesOf(limit?.value ?? '0'))
          )
        })
      );

      return;
    }

    setDraft(null);
    if (next !== value) onCommit(next);
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {label}
      </Label>

      <MoneyInput
        id={inputId}
        value={shown}
        decimals={decimals}
        placeholder={t('anyAmount')}
        aria-invalid={issue !== null}
        aria-describedby={issue === null ? undefined : errorId}
        className={cn('h-9', value !== undefined && ACTIVE_FILTER_CLASS)}
        onValueChange={edit}
        onRejectedPaste={(reading) =>
          setIssue(pastedAmountIssueOf(reading, tValidation, format))
        }
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />

      {issue !== null && (
        <p id={errorId} className={cn('text-xs text-negative', APPEAR_CLASS)}>
          {issue}
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
  const t = useTranslations('bills.filters');
  const pickerId = useId();

  return (
    <div className="min-w-0 space-y-1.5">
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
            aria-label={t('clearDay', { label })}
            onClick={() => onChange(undefined)}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const FilterSelect: FC<
  Record<'label' | 'allLabel' | 'value', string> &
    Record<'options', ReadonlyArray<Record<'value' | 'label', string>>> &
    Record<'isActive', boolean> &
    Record<'onValueChange', (value: string) => void> &
    Partial<Record<'isLabelHidden' | 'isSearchable', boolean>> &
    Partial<Record<'className', string>>
> = ({
  label,
  allLabel,
  value,
  options,
  isActive,
  onValueChange,
  isLabelHidden = false,
  isSearchable = false,
  className
}) => {
  const triggerId = useId();
  const triggerClass = cn('h-9', isActive && ACTIVE_FILTER_CLASS);

  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label
        htmlFor={triggerId}
        className={isLabelHidden ? 'sr-only' : 'text-xs text-muted-foreground'}
      >
        {label}
      </Label>

      {isSearchable ? (
        <SearchableSelect
          id={triggerId}
          value={value}
          options={[{ value: ALL_OPTION, label: allLabel }, ...options]}
          className={triggerClass}
          onValueChange={onValueChange}
        />
      ) : (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger id={triggerId} className={triggerClass}>
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={ALL_OPTION}>{allLabel}</SelectItem>

            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

const BillSort: FC<
  Record<'listing', BillListing> & Record<'refine', Refine>
> = ({ listing, refine }) => {
  const t = useTranslations('bills.sort');
  const sortId = useId();
  const SortOrderIcon =
    listing.sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow;

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex items-center gap-2 max-sm:w-full"
    >
      <Label htmlFor={sortId} className="sr-only">
        {t('by')}
      </Label>

      <Select
        value={listing.sortBy}
        onValueChange={(value) => {
          const field = SORT_FIELDS.find((sortField) => sortField === value);

          if (field !== undefined)
            refine({ sortBy: field, sortOrder: firstOrderOf(field) });
        }}
      >
        <SelectTrigger id={sortId} className="h-9 w-auto gap-1.5 max-sm:flex-1">
          <span aria-hidden="true" className="text-muted-foreground">
            {t('by')}
          </span>

          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {SORT_FIELDS.map((field) => (
            <SelectItem key={field} value={field}>
              {t(`fields.${field}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        aria-label={t('descending')}
        aria-pressed={listing.sortOrder === 'desc'}
        title={t('descending')}
        onClick={() => refine({ sortOrder: REVERSED_ORDER[listing.sortOrder] })}
      >
        <SortOrderIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
};

/**
 * Search, status and sort stay in view; the rarer filters fold into a panel,
 * open from the start when one of them is set. Every filter in force shows as
 * a chip that removes it, whether the panel is open or not.
 */
const BillFilters: FC<
  Record<'listing', BillListing> &
    Record<'refine', Refine> &
    Record<'searchField', ReactNode> &
    Record<'onClear', VoidFunction>
> = ({ listing, refine, searchField, onClear }) => {
  const t = useTranslations('bills.filters');
  const tChips = useTranslations('bills.filters.chips');
  const tFinances = useTranslations('finances');
  const tActions = useTranslations('common.actions');
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelFilterCount = PANEL_FILTERS.filter(
    (filter) => listing[filter] !== undefined
  ).length;
  const [isPanelOpen, setIsPanelOpen] = useState(() => panelFilterCount > 0);
  const format = useFormat();
  const activeFilters = activeFiltersOf(listing, tChips, tFinances, format);
  const statusOptions = EXPENSE_STATUS_FILTERS.map((status) => ({
    value: status,
    label: tFinances(`statusFilters.${status}`)
  }));
  const kindOptions = EXPENSE_KINDS.map((kind) => ({
    value: kind,
    label: tFinances(`kinds.${kind}`)
  }));
  const categoryOptions = EXPENSE_CATEGORIES.map((category) => ({
    value: category,
    label: tFinances(`categories.${category}`)
  }));
  const amountDecimals = currencyFractionDigits(
    listing.currency ?? DEFAULT_CURRENCY
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 basis-full lg:basis-0 lg:flex-1">
          {searchField}
        </div>

        <FilterSelect
          isLabelHidden
          label={t('status')}
          allLabel={t('allStatuses')}
          value={listing.status ?? ALL_OPTION}
          options={statusOptions}
          isActive={listing.status !== undefined}
          className="min-w-36 flex-1 lg:w-44 lg:flex-none"
          onValueChange={(value) =>
            refine({
              status: EXPENSE_STATUS_FILTERS.find((status) => status === value)
            })
          }
        />

        <Button
          ref={toggleRef}
          variant="outline"
          size="sm"
          aria-expanded={isPanelOpen}
          aria-controls={panelId}
          className={cn(
            'gap-1.5',
            panelFilterCount > 0 && !isPanelOpen && ACTIVE_FILTER_CLASS
          )}
          onClick={() => setIsPanelOpen((isOpen) => !isOpen)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />

          <span>{t('more')}</span>

          {panelFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
              {t.rich('activeCount', {
                count: panelFilterCount,
                hidden: srOnly
              })}
            </span>
          )}
        </Button>

        <BillSort listing={listing} refine={refine} />
      </div>

      <div
        id={panelId}
        hidden={!isPanelOpen}
        className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FilterSelect
          label={t('kind')}
          allLabel={t('allKinds')}
          value={listing.kind ?? ALL_OPTION}
          options={kindOptions}
          isActive={listing.kind !== undefined}
          onValueChange={(value) =>
            refine({ kind: EXPENSE_KINDS.find((kind) => kind === value) })
          }
        />

        <FilterSelect
          label={t('category')}
          allLabel={t('allCategories')}
          value={listing.category ?? ALL_OPTION}
          options={categoryOptions}
          isActive={listing.category !== undefined}
          isSearchable
          className="lg:col-span-2"
          onValueChange={(value) =>
            refine({
              category: EXPENSE_CATEGORIES.find(
                (category) => category === value
              )
            })
          }
        />

        <DayFilter
          label={t('dueFrom')}
          value={listing.dueFrom}
          onChange={(dueFrom) => refine({ dueFrom })}
        />

        <DayFilter
          label={t('dueTo')}
          value={listing.dueTo}
          onChange={(dueTo) => refine({ dueTo })}
        />

        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
          <AmountFilter
            label={t('minAmount')}
            value={listing.minAmount}
            decimals={amountDecimals}
            limit={
              listing.maxAmount === undefined
                ? undefined
                : { side: 'max', value: listing.maxAmount }
            }
            onCommit={(minAmount) => refine({ minAmount })}
          />

          <AmountFilter
            label={t('maxAmount')}
            value={listing.maxAmount}
            decimals={amountDecimals}
            limit={
              listing.minAmount === undefined
                ? undefined
                : { side: 'min', value: listing.minAmount }
            }
            onCommit={(maxAmount) => refine({ maxAmount })}
          />
        </div>
      </div>

      {hasRefinementIn(listing) && (
        <div
          role="group"
          aria-label={t('inForce')}
          className="flex flex-wrap items-center gap-2"
        >
          {activeFilters.map(({ label, refinement }) => (
            <Button
              key={label}
              variant="outline"
              size="xs"
              className={cn('gap-1.5 font-normal', ACTIVE_FILTER_CLASS)}
              onClick={() => {
                refine(refinement);
                toggleRef.current?.focus();
              }}
            >
              {label}

              <X aria-hidden="true" className="size-3.5" />

              <span className="sr-only">{t('remove')}</span>
            </Button>
          ))}

          <Button
            variant="ghost"
            size="xs"
            className="gap-1.5 text-muted-foreground"
            onClick={onClear}
          >
            <X aria-hidden="true" className="size-4" />

            {tActions('clearAll')}
          </Button>
        </div>
      )}
    </div>
  );
};

const BillAmount: FC<Record<'expense', Expense>> = ({ expense }) => {
  const t = useTranslations('bills');
  const { formatMoney } = useFormat();
  const { amount, outstandingAmount, settledAmount, currency } = expense;
  const isPartlySettled =
    isOpenExpense(expense) && isNonzeroDecimal(settledAmount);

  return (
    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
      <span
        className={cn(
          'font-medium',
          expense.status === 'CANCELLED' && 'line-through'
        )}
      >
        <Money value={amount} currency={currency} />
      </span>

      {isPartlySettled && (
        <span className="text-xs text-muted-foreground">
          {t('outstanding', {
            amount: formatMoney(outstandingAmount, currency)
          })}
        </span>
      )}
    </div>
  );
};

const BillRow: FC<
  Record<'expense', Expense> &
    Record<'href', string> &
    Record<'today', string> &
    Record<'onPay', (expense: Expense) => void>
> = ({ expense, href, today, onPay }) => {
  const t = useTranslations('bills');
  const tFinances = useTranslations('finances');
  const { description, category, dueDate, status } = expense;
  const isOpen = isOpenExpense(expense);
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today, tFinances) : null;

  return (
    <TableRow className={cn(status === 'CANCELLED' && 'text-muted-foreground')}>
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
            {t('meta', {
              origin: originLabelOf(expense, tFinances),
              category: tFinances(`categories.${category}`)
            })}
          </span>

          <span className="text-xs text-muted-foreground md:hidden">
            {t.rich('dueOn', { day: () => <CalendarDayText day={dueDate} /> })}
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

      <TableCell className="w-0 text-right">
        {isOpen && (
          <Button
            variant="outline"
            size="xs"
            aria-label={t('payBill', { description })}
            onClick={() => onPay(expense)}
          >
            {t('pay')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

/** Each alert opens the bills it counts, as the overview's do. */
const AlertsStrip: FC = () => {
  const t = useTranslations('bills.alerts');
  const { data } = useFinanceAlerts();
  const today = useReferenceDay();

  if (data === undefined) return null;

  const { overdue, dueSoon, reminders } = data;
  const { reminderLeadDays } = reminders;

  if (overdue.count === 0 && dueSoon.count === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {overdue.count > 0 && (
        <AlertTotals
          tone="negative"
          title={t('overdue', { count: overdue.count })}
          totals={overdue.totals}
          href={billsRouteFor({ status: 'OVERDUE' })}
        />
      )}

      {dueSoon.count > 0 && (
        <AlertTotals
          tone="warning"
          title={t('dueSoon', {
            count: dueSoon.count,
            days: reminderLeadDays
          })}
          totals={dueSoon.totals}
          href={billsRouteFor({
            status: 'PENDING',
            dueFrom: today,
            dueTo: shiftCalendarDay(today, reminderLeadDays) ?? today,
            ...(reminders.remindUpcomingBills ? {} : { kind: 'INSTALLMENT' })
          })}
        />
      )}
    </div>
  );
};

export const BillsView: FC = () => {
  const t = useTranslations('bills');
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const listing = useMemo(() => listingFrom(searchParams), [searchParams]);
  const openBillId = searchParams.get(BILL_DETAIL_PARAM);

  const [isAdding, setIsAdding] = useState(false);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [searchInput, setSearchInput] = useState(() => listing.search ?? '');
  const committedSearch = useRef(listing.search);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const searchId = useId();

  const { mutateAsync: recordPayment } = useRecordPayment();

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
        title={t('title')}
        description={t('description')}
        action={
          <Button
            size="sm"
            className="gap-1.5 max-sm:w-full"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={16} aria-hidden="true" />

            {t('add')}
          </Button>
        }
      />

      <AlertsStrip />

      <section aria-labelledby={headingId} className="min-w-0">
        <Card>
          <SectionHeader id={headingId} title={t('allBills')} />

          <CardContent className="space-y-4">
            <div role="search" aria-label={t('filter')}>
              <BillFilters
                listing={listing}
                refine={refine}
                searchField={
                  <>
                    <Label htmlFor={searchId} className="sr-only">
                      {t('search')}
                    </Label>

                    <Input
                      ref={searchInputRef}
                      id={searchId}
                      type="search"
                      placeholder={t('searchPlaceholder')}
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
                  </>
                }
                onClear={clearRefinements}
              />
            </div>

            <div
              aria-busy={isLoading || isPlaceholderData}
              className="space-y-4"
            >
              {isLoading && (
                <LoadingState label={t('loading')}>
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

                        <Skeleton className="h-8 w-12" />
                      </div>
                    ))}
                  </div>
                </LoadingState>
              )}

              {data === undefined && isError && (
                <ErrorState message={t('loadFailed')} onRetry={refetch} />
              )}

              {isRefetchError && (
                <StaleState isRetrying={isFetching} onRetry={refetch} />
              )}

              {data?.total === 0 && !hasRefinement && (
                <EmptyState
                  icon={ReceiptText}
                  title={t('emptyTitle')}
                  message={t('empty')}
                  action={{
                    label: t('add'),
                    onSelect: () => setIsAdding(true)
                  }}
                />
              )}

              {data?.total === 0 && hasRefinement && (
                <NoResultsState
                  message={t('noResults')}
                  onClear={clearRefinements}
                />
              )}

              {data !== undefined &&
                data.total > 0 &&
                data.items.length === 0 && (
                  <EmptyState
                    message={t('emptyPage', { page: data.page })}
                    action={{
                      label: t('goToPage', { page: data.totalPages }),
                      onSelect: () => refine({ page: data.totalPages })
                    }}
                  />
                )}

              {data !== undefined && data.items.length > 0 && (
                <Table
                  label={t('table')}
                  className={cn(
                    'transition-opacity',
                    isPlaceholderData && 'opacity-60'
                  )}
                >
                  <TableCaption className="sr-only">
                    {t('caption', {
                      field: t(`sort.fields.${listing.sortBy}`),
                      order: listing.sortOrder
                    })}
                  </TableCaption>

                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('columns.bill')}</TableHead>

                      <TableHead className={COLUMN_VISIBILITY.due}>
                        {t('columns.due')}
                      </TableHead>

                      <TableHead className="text-right">
                        {t('columns.amount')}
                      </TableHead>

                      <TableHead
                        className={cn('text-right', COLUMN_VISIBILITY.status)}
                      >
                        {t('columns.status')}
                      </TableHead>

                      <TableHead className="w-0">
                        <span className="sr-only">{t('columns.actions')}</span>
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
                        onPay={setPayingExpense}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}

              {data !== undefined && data.total > 0 && (
                <div className="flex justify-end">
                  <PageNavigation
                    label={t('pages')}
                    page={data.page}
                    totalPages={data.totalPages}
                    detail={pageDetailOf(data, t)}
                    onPageChange={(page) => refine({ page })}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <BillDialogs expenseId={openBillId} onClose={closeBill} />

      {payingExpense !== null && (
        <PaymentFormDialog
          target={{ kind: 'record', expense: payingExpense }}
          onCancel={() => setPayingExpense(null)}
          onSubmit={async (payment) => {
            await recordPayment({ ...payment, expenseId: payingExpense.id });
            setPayingExpense(null);
          }}
        />
      )}

      {isAdding && <AddBillDialog onClose={() => setIsAdding(false)} />}
    </div>
  );
};
