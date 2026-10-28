'use client';

import { useId, useState, type FC } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Plus } from 'lucide-react';

import type {
  RecurringExpense,
  RecurringExpenseStatus
} from '@/app/api/v1/finances';
import {
  EXPENSE_CATEGORY_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_FREQUENCY_UNITS,
  RECURRING_EXPENSE_DETAIL_PARAM,
  RECURRING_EXPENSE_STATUS_LABELS,
  RECURRING_EXPENSE_STATUSES
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
import { Money } from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from '@/components/ui';
import {
  useCreateRecurringExpense,
  useRecurringExpenses,
  useReferenceDay
} from '@/hooks/use-finances';
import { FIRST_PAGE, pageNumberFrom } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import {
  CalendarDayText,
  dueDistanceOf,
  SeriesStatusBadge
} from './finance-display';
import { RecurringExpenseDialogs } from './recurring-expense-dialogs';
import { CreateSeriesDialog } from './recurring-expense-forms';

const PAGE_SIZE = 20;
const ALL_OPTION = 'all';

const LISTING_PARAMS = { Page: 'page', Status: 'status' } as const;

const SKELETON_ROWS = Array.from({ length: 5 }, (_, row) => row);

const NextBillText: FC<
  Record<'series', RecurringExpense> & Record<'today', string>
> = ({ series: { status, nextDueDate, endDate }, today }) => {
  if (status === 'CANCELLED') return 'No more bills';

  if (status === 'ENDED' && endDate !== null)
    return (
      <>
        {'Ended '}

        <CalendarDayText day={endDate} />
      </>
    );

  if (nextDueDate === null) return 'No bill ahead';

  const distance = dueDistanceOf(nextDueDate, today);

  return (
    <>
      {'Next '}

      <CalendarDayText day={nextDueDate} />

      {distance !== null && ` · ${distance}`}
    </>
  );
};

const SeriesRow: FC<
  Record<'series', RecurringExpense> &
    Record<'href', string> &
    Record<'today', string>
> = ({ series, href, today }) => {
  const {
    description,
    category,
    frequency,
    status,
    amount,
    isVariable,
    monthlyEquivalent,
    currency
  } = series;

  return (
    <li className="relative grid gap-x-6 gap-y-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <Link
          href={href}
          scroll={false}
          className="line-clamp-2 rounded-sm font-semibold ring-offset-background wrap-anywhere after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {description}
        </Link>

        <span className="text-xs text-muted-foreground">
          {`${EXPENSE_CATEGORY_LABELS[category]} · ${RECURRENCE_FREQUENCY_LABELS[frequency]}`}
        </span>

        <span className="text-xs text-muted-foreground">
          <NextBillText series={series} today={today} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
        <div className="flex flex-col whitespace-nowrap sm:items-end">
          <span className="font-medium tabular-nums">
            {isVariable && (
              <span className="font-normal text-muted-foreground">about </span>
            )}

            <Money value={amount} currency={currency} />

            <span className="font-normal text-muted-foreground">
              {` a ${RECURRENCE_FREQUENCY_UNITS[frequency]}`}
            </span>
          </span>

          {frequency !== 'MONTHLY' && (
            <span className="text-xs text-muted-foreground">
              {`about ${formatMoney(monthlyEquivalent, currency)} a month`}
            </span>
          )}
        </div>

        <SeriesStatusBadge status={status} />
      </div>
    </li>
  );
};

export const RecurringView: FC = () => {
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const headingId = useId();
  const statusId = useId();
  const [isAdding, setIsAdding] = useState(false);

  const page = pageNumberFrom(searchParams.get(LISTING_PARAMS.Page));
  const status = RECURRING_EXPENSE_STATUSES.find(
    (candidate) => candidate === searchParams.get(LISTING_PARAMS.Status)
  );
  const openSeriesId = searchParams.get(RECURRING_EXPENSE_DETAIL_PARAM);

  const { mutateAsync: createSeries } = useCreateRecurringExpense();
  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useRecurringExpenses({ page, pageSize: PAGE_SIZE, status });

  const isLoading = data === undefined && !isError;

  const updateListing = (
    refinement: Partial<Record<'page', number>> &
      Partial<Record<'status', RecurringExpenseStatus | undefined>>
  ) => {
    const params = new URLSearchParams(searchParams);
    const nextPage = refinement.page ?? FIRST_PAGE;
    const nextStatus = 'status' in refinement ? refinement.status : status;

    if (nextPage === FIRST_PAGE) params.delete(LISTING_PARAMS.Page);
    else params.set(LISTING_PARAMS.Page, String(nextPage));

    if (nextStatus === undefined) params.delete(LISTING_PARAMS.Status);
    else params.set(LISTING_PARAMS.Status, nextStatus);

    updateUrlQuery(params);
  };

  const seriesHref = (seriesId: string) => {
    const params = new URLSearchParams(searchParams);

    params.set(RECURRING_EXPENSE_DETAIL_PARAM, seriesId);

    return `?${params}`;
  };

  const closeSeries = () => {
    const params = new URLSearchParams(searchParams);

    params.delete(RECURRING_EXPENSE_DETAIL_PARAM);
    updateUrlQuery(params);
  };

  const statusFilter = (
    <div className="flex items-center gap-2 max-sm:w-full">
      <Label htmlFor={statusId} className="sr-only">
        Status
      </Label>

      <Select
        value={status ?? ALL_OPTION}
        onValueChange={(value) =>
          updateListing({
            status: RECURRING_EXPENSE_STATUSES.find(
              (candidate) => candidate === value
            )
          })
        }
      >
        <SelectTrigger
          id={statusId}
          className={cn(
            'h-9 w-auto gap-1.5 max-sm:flex-1',
            status !== undefined &&
              'border-primary/50 bg-primary/5 text-foreground'
          )}
        >
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL_OPTION}>All statuses</SelectItem>

          {RECURRING_EXPENSE_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {RECURRING_EXPENSE_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring"
        description="Expenses that repeat every week, month or year, and the bills each one adds ahead of time"
        action={
          <Button
            size="sm"
            className="gap-1.5 max-sm:w-full"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={16} aria-hidden="true" />
            Add recurring expense
          </Button>
        }
      />

      <section aria-labelledby={headingId} className="min-w-0">
        <Card>
          <SectionHeader
            id={headingId}
            title="Recurring expenses"
            action={statusFilter}
          />

          <CardContent
            aria-busy={isLoading || isPlaceholderData}
            className="space-y-4"
          >
            {isLoading && (
              <LoadingState label="Loading recurring expenses">
                <div aria-hidden="true" className="divide-y">
                  {SKELETON_ROWS.map((row) => (
                    <div
                      key={row}
                      className="grid gap-x-6 gap-y-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-44" />

                        <Skeleton className="h-3 w-56" />
                      </div>

                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </LoadingState>
            )}

            {data === undefined && isError && (
              <ErrorState
                message="The recurring expenses could not be loaded"
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

            {data?.total === 0 && status === undefined && (
              <EmptyState
                message="No recurring expenses yet"
                action={{
                  label: 'Add recurring expense',
                  onSelect: () => setIsAdding(true)
                }}
              />
            )}

            {data?.total === 0 && status !== undefined && (
              <NoResultsState
                message={`No ${RECURRING_EXPENSE_STATUS_LABELS[status].toLowerCase()} recurring expenses`}
                onClear={() => updateListing({ status: undefined })}
              />
            )}

            {data !== undefined &&
              data.total > 0 &&
              data.items.length === 0 && (
                <EmptyState
                  message={`No recurring expenses on page ${data.page}`}
                  action={{
                    label: `Go to page ${data.totalPages}`,
                    onSelect: () => updateListing({ page: data.totalPages })
                  }}
                />
              )}

            {data !== undefined && data.items.length > 0 && (
              <ul
                aria-label="Recurring expenses"
                className={cn(
                  'divide-y transition-opacity',
                  isPlaceholderData && 'opacity-60'
                )}
              >
                {data.items.map((series) => (
                  <SeriesRow
                    key={series.id}
                    series={series}
                    href={seriesHref(series.id)}
                    today={today}
                  />
                ))}
              </ul>
            )}

            {data !== undefined && data.total > 0 && (
              <div className="flex justify-end">
                <PageNavigation
                  label="Recurring expense pages"
                  page={data.page}
                  totalPages={data.totalPages}
                  detail={`${data.total} recurring ${data.total === 1 ? 'expense' : 'expenses'}`}
                  onPageChange={(nextPage) => updateListing({ page: nextPage })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <RecurringExpenseDialogs seriesId={openSeriesId} onClose={closeSeries} />

      {isAdding && (
        <CreateSeriesDialog
          onCancel={() => setIsAdding(false)}
          onSubmit={async (series) => {
            await createSeries(series);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
};
