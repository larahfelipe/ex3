'use client';

import { useId, useState, type FC } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Check, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';

import type { CalendarDayFigures, Expense } from '@/app/api/v1/finances';
import { BILL_DETAIL_PARAM, EXPENSE_CATEGORY_LABELS } from '@/common/constants';
import { formatMoney, updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  STALE_DATA_MESSAGE,
  StaleState
} from '@/components/data-state';
import { Money } from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';
import {
  useExpenses,
  useFinanceCalendar,
  useReferenceDay
} from '@/hooks/use-finances';
import {
  calendarMonthOfDay,
  daysOfCalendarMonth,
  formatLongCalendarMonth,
  formatLongWeekdayCalendarDay,
  formatWeekdayCalendarDay,
  isCalendarDay,
  isCalendarMonth,
  shiftCalendarMonth
} from '@/lib/dates';
import { isNonzeroDecimal } from '@/lib/decimal';
import { FIRST_PAGE } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import { BillDialogs } from './bill-dialogs';
import {
  ExpenseStatusBadge,
  isOpenExpense,
  originLabelOf
} from './finance-display';

type DayCellProps = Record<'day', string> &
  Record<'figures', CalendarDayFigures | undefined> &
  Record<'isSelected' | 'isToday', boolean> &
  Record<'onSelect', VoidFunction>;

const CALENDAR_PARAMS = { Month: 'month', Day: 'day' } as const;

const DAY_PAGE_SIZE = 20;

const DAYS_IN_WEEK = 7;

const WEEKDAYS = [
  { short: 'Sun', long: 'Sunday' },
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' }
] as const;

const SKELETON_WEEKS = Array.from({ length: 5 }, (_, week) => week);

const countText = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The month's days in weeks from Sunday, with null for the cells outside it. */
const weeksOf = (month: string) => {
  const layout = daysOfCalendarMonth(month);

  if (layout === null) return [];

  const cells = [
    ...Array.from({ length: layout.firstWeekday }, () => null),
    ...layout.days
  ];
  const trailing =
    (DAYS_IN_WEEK - (cells.length % DAYS_IN_WEEK)) % DAYS_IN_WEEK;
  const padded = [...cells, ...Array.from({ length: trailing }, () => null)];

  return Array.from({ length: padded.length / DAYS_IN_WEEK }, (_, week) =>
    padded.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK)
  );
};

/** A day's bills split as its markers show them: overdue, still due and paid. */
const dayCountsOf = ({
  count,
  paidCount,
  overdueCount
}: CalendarDayFigures) => ({
  overdue: overdueCount,
  due: count - paidCount - overdueCount,
  paid: paidCount
});

const daySummaryOf = (figures: CalendarDayFigures | undefined) => {
  if (figures === undefined) return 'nothing due';

  const { overdue, due, paid } = dayCountsOf(figures);

  return [
    overdue > 0 && `${overdue} overdue`,
    due > 0 && `${countText(due, 'bill')} due`,
    paid > 0 && `${paid} paid`
  ]
    .filter(Boolean)
    .join(', ');
};

const DayMarkers: FC<Record<'figures', CalendarDayFigures>> = ({ figures }) => {
  const { overdue, due, paid } = dayCountsOf(figures);

  return (
    <span
      aria-hidden="true"
      className="flex flex-col gap-0.5 text-[0.6875rem] leading-tight tabular-nums"
    >
      {overdue > 0 && (
        <span className="flex items-center gap-1 font-medium text-negative">
          <CircleAlert className="size-3 shrink-0" />

          {overdue}

          <span className="max-md:hidden">overdue</span>
        </span>
      )}

      {due > 0 && (
        <span className="flex items-center gap-1 text-foreground">
          <span className="mx-0.5 size-2 shrink-0 rounded-full bg-primary" />

          {due}

          <span className="max-md:hidden">due</span>
        </span>
      )}

      {paid > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Check className="size-3 shrink-0" />

          {paid}

          <span className="max-md:hidden">paid</span>
        </span>
      )}
    </span>
  );
};

const DayCell: FC<DayCellProps> = ({
  day,
  figures,
  isSelected,
  isToday,
  onSelect
}) => (
  <td className="p-0.5 align-top">
    <button
      type="button"
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      aria-label={`${formatLongWeekdayCalendarDay(day) ?? day}: ${daySummaryOf(figures)}`}
      className={cn(
        'flex min-h-16 w-full flex-col items-start gap-1 rounded-md border p-1 text-left ring-offset-background transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:min-h-24 sm:p-1.5',
        isSelected ? 'border-primary bg-primary/10' : 'border-transparent'
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs tabular-nums',
          isToday && 'bg-primary font-semibold text-primary-foreground'
        )}
      >
        {Number(day.slice(-2))}
      </span>

      {figures !== undefined && <DayMarkers figures={figures} />}
    </button>
  </td>
);

const MonthGridSkeleton: FC = () => (
  <LoadingState label="Loading the calendar">
    <div aria-hidden="true" className="grid grid-cols-7 gap-1">
      {SKELETON_WEEKS.flatMap((week) =>
        WEEKDAYS.map(({ short }) => (
          <Skeleton key={`${week}-${short}`} className="h-16 sm:h-24" />
        ))
      )}
    </div>
  </LoadingState>
);

const Legend: FC = () => (
  <p
    aria-hidden="true"
    className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
  >
    <span className="flex items-center gap-1">
      <CircleAlert className="size-3 text-negative" />
      Overdue
    </span>

    <span className="flex items-center gap-1">
      <span className="mx-0.5 size-2 rounded-full bg-primary" />
      Due
    </span>

    <span className="flex items-center gap-1">
      <Check className="size-3" />
      Paid
    </span>
  </p>
);

const DayBillRow: FC<Record<'expense', Expense> & Record<'href', string>> = ({
  expense,
  href
}) => {
  const {
    description,
    category,
    amount,
    outstandingAmount,
    settledAmount,
    currency,
    status
  } = expense;
  const isPartlySettled =
    isOpenExpense(expense) && isNonzeroDecimal(settledAmount);

  return (
    <li className="relative flex items-start justify-between gap-3 py-3">
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
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 whitespace-nowrap">
        <span className="font-medium tabular-nums">
          <Money value={amount} currency={currency} />
        </span>

        {isPartlySettled && (
          <span className="text-xs text-muted-foreground">
            {`${formatMoney(outstandingAmount, currency)} left`}
          </span>
        )}

        <ExpenseStatusBadge status={status} />
      </div>
    </li>
  );
};

const DayBills: FC<
  Record<'day', string> &
    Record<'figures', CalendarDayFigures | undefined> &
    Record<'billHref', (expenseId: string) => string>
> = ({ day, figures, billHref }) => {
  const headingId = useId();
  const [page, setPage] = useState(FIRST_PAGE);

  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useExpenses({
    dueFrom: day,
    dueTo: day,
    sortBy: 'amount',
    sortOrder: 'desc',
    page,
    pageSize: DAY_PAGE_SIZE
  });

  const isLoading = data === undefined && !isError;
  const owed = figures?.totals.filter(({ outstanding }) =>
    isNonzeroDecimal(outstanding)
  );
  const description =
    owed === undefined
      ? 'Nothing due'
      : owed.length === 0
        ? 'All paid'
        : `${owed.map(({ outstanding, currency }) => formatMoney(outstanding, currency)).join(' · ')} left to pay`;

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card>
        <SectionHeader
          id={headingId}
          title={formatWeekdayCalendarDay(day) ?? day}
          description={description}
        />

        <CardContent
          aria-busy={isLoading || isPlaceholderData}
          className="space-y-3"
        >
          {isLoading && (
            <LoadingState label="Loading the day's bills">
              <div aria-hidden="true" className="space-y-3">
                <Skeleton className="h-10 w-full" />

                <Skeleton className="h-10 w-full" />
              </div>
            </LoadingState>
          )}

          {data === undefined && isError && (
            <ErrorState
              message="The day's bills could not be loaded"
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

          {data?.total === 0 && <EmptyState message="No bills due this day" />}

          {data !== undefined && data.items.length > 0 && (
            <ul
              aria-label={`Bills due ${formatLongWeekdayCalendarDay(day) ?? day}`}
              className={cn(
                'divide-y transition-opacity',
                isPlaceholderData && 'opacity-60'
              )}
            >
              {data.items.map((expense) => (
                <DayBillRow
                  key={expense.id}
                  expense={expense}
                  href={billHref(expense.id)}
                />
              ))}
            </ul>
          )}

          {data !== undefined && data.totalPages > 1 && (
            <PageNavigation
              label="Day bill pages"
              page={data.page}
              totalPages={data.totalPages}
              detail={countText(data.total, 'bill')}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export const CalendarView: FC = () => {
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const headingId = useId();

  const currentMonth = calendarMonthOfDay(today) ?? today.slice(0, 7);
  const requestedMonth = searchParams.get(CALENDAR_PARAMS.Month);
  const month =
    requestedMonth !== null && isCalendarMonth(requestedMonth)
      ? requestedMonth
      : currentMonth;
  const requestedDay = searchParams.get(CALENDAR_PARAMS.Day);
  const selectedDay =
    requestedDay !== null &&
    isCalendarDay(requestedDay) &&
    calendarMonthOfDay(requestedDay) === month
      ? requestedDay
      : month === currentMonth
        ? today
        : null;
  const openBillId = searchParams.get(BILL_DETAIL_PARAM);

  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useFinanceCalendar({ month });

  const isLoading = data === undefined && !isError;
  const figuresByDay = new Map(
    data?.days.map((figures) => [figures.date, figures])
  );
  const weeks = weeksOf(month);

  const showMonth = (nextMonth: string | null) => {
    if (nextMonth === null) return;

    const params = new URLSearchParams(searchParams);

    if (nextMonth === currentMonth) params.delete(CALENDAR_PARAMS.Month);
    else params.set(CALENDAR_PARAMS.Month, nextMonth);

    params.delete(CALENDAR_PARAMS.Day);
    updateUrlQuery(params);
  };

  const selectDay = (day: string) => {
    const params = new URLSearchParams(searchParams);

    params.set(CALENDAR_PARAMS.Day, day);
    updateUrlQuery(params);
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

  const monthLabel = formatLongCalendarMonth(month) ?? month;

  const monthNavigation = (
    <nav aria-label="Months" className="flex items-center gap-1">
      {month !== currentMonth && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => showMonth(currentMonth)}
        >
          This month
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={() => showMonth(shiftCalendarMonth(month, -1))}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />

        <span className="sr-only">Previous month</span>
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="size-9"
        onClick={() => showMonth(shiftCalendarMonth(month, 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />

        <span className="sr-only">Next month</span>
      </Button>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Bills by the day they are due: what is overdue, still due and paid each day of the month"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section aria-labelledby={headingId} className="min-w-0">
          <Card>
            <SectionHeader
              id={headingId}
              title={monthLabel}
              action={monthNavigation}
            />

            <CardContent
              aria-busy={isLoading || isPlaceholderData}
              className="space-y-4"
            >
              {isLoading && <MonthGridSkeleton />}

              {data === undefined && isError && (
                <ErrorState
                  message="The calendar could not be loaded"
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

              {data !== undefined && (
                <>
                  <table
                    className={cn(
                      'w-full table-fixed border-separate border-spacing-0 transition-opacity',
                      isPlaceholderData && 'opacity-60'
                    )}
                  >
                    <caption className="sr-only">{`Bills due in ${monthLabel}`}</caption>

                    <thead>
                      <tr>
                        {WEEKDAYS.map(({ short, long }) => (
                          <th
                            key={short}
                            scope="col"
                            abbr={long}
                            className="px-1 pb-2 text-left text-xs font-medium text-muted-foreground sm:px-2"
                          >
                            {short}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {weeks.map((week) => (
                        <tr key={week.find((day) => day !== null)}>
                          {week.map((day, weekday) =>
                            day === null ? (
                              <td key={WEEKDAYS[weekday].short} />
                            ) : (
                              <DayCell
                                key={day}
                                day={day}
                                figures={figuresByDay.get(day)}
                                isSelected={day === selectedDay}
                                isToday={day === today}
                                onSelect={() => selectDay(day)}
                              />
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <Legend />

                  {data.days.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {`Nothing is due in ${monthLabel}.`}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {selectedDay === null ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Choose a day to see the bills due on it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <DayBills
            key={selectedDay}
            day={selectedDay}
            figures={figuresByDay.get(selectedDay)}
            billHref={billHref}
          />
        )}
      </div>

      <BillDialogs expenseId={openBillId} onClose={closeBill} />
    </div>
  );
};
