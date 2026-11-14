'use client';

import { useId, useState, type FC } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Check, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { CalendarDayFigures, Expense } from '@/app/api/v1/finances';
import { BILL_DETAIL_PARAM } from '@/common/constants';
import { updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
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
  DialogPresence,
  Skeleton
} from '@/components/ui';
import {
  useExpenses,
  useFinanceCalendar,
  useReferenceDay
} from '@/hooks/use-finances';
import { useFormat, type Format } from '@/i18n/format';
import type { Translator } from '@/i18n/translator';
import {
  calendarMonthOfDay,
  daysOfCalendarMonth,
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

const weekdaysOf = ({ weekdayNames }: Format) => {
  const longNames = weekdayNames('long');

  return weekdayNames('short').map((short, weekday) => ({
    short,
    long: longNames[weekday]
  }));
};

const SKELETON_WEEKS = Array.from({ length: 5 }, (_, week) => week);

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

const daySummaryOf = (
  figures: CalendarDayFigures | undefined,
  t: Translator<'calendar.daySummary'>,
  { formatList }: Format
) => {
  if (figures === undefined) return t('none');

  const { overdue, due, paid } = dayCountsOf(figures);

  return formatList(
    [
      overdue > 0 && t('overdue', { count: overdue }),
      due > 0 && t('due', { count: due }),
      paid > 0 && t('paid', { count: paid })
    ].filter((part) => part !== false)
  );
};

const DayMarkers: FC<Record<'figures', CalendarDayFigures>> = ({ figures }) => {
  const t = useTranslations('calendar.markers');
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

          <span className="max-md:hidden">
            {t('overdue', { count: overdue })}
          </span>
        </span>
      )}

      {due > 0 && (
        <span className="flex items-center gap-1 text-foreground">
          <span className="mx-0.5 size-2 shrink-0 rounded-full bg-primary" />

          {due}

          <span className="max-md:hidden">{t('due')}</span>
        </span>
      )}

      {paid > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Check className="size-3 shrink-0" />

          {paid}

          <span className="max-md:hidden">{t('paid', { count: paid })}</span>
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
}) => {
  const t = useTranslations('calendar');
  const tSummary = useTranslations('calendar.daySummary');
  const format = useFormat();

  return (
    <td className="p-0.5 align-top">
      <button
        type="button"
        aria-pressed={isSelected}
        aria-current={isToday ? 'date' : undefined}
        aria-label={t('dayLabel', {
          day: format.formatLongWeekdayCalendarDay(day) ?? day,
          summary: daySummaryOf(figures, tSummary, format)
        })}
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
};

const MonthGridSkeleton: FC = () => {
  const t = useTranslations('calendar');
  const weekdays = weekdaysOf(useFormat());

  return (
    <LoadingState label={t('loading')}>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1">
        {SKELETON_WEEKS.flatMap((week) =>
          weekdays.map(({ short }) => (
            <Skeleton key={`${week}-${short}`} className="h-16 sm:h-24" />
          ))
        )}
      </div>
    </LoadingState>
  );
};

const Legend: FC = () => {
  const t = useTranslations('calendar.legend');

  return (
    <p
      aria-hidden="true"
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <span className="flex items-center gap-1">
        <CircleAlert className="size-3 text-negative" />

        {t('overdue')}
      </span>

      <span className="flex items-center gap-1">
        <span className="mx-0.5 size-2 rounded-full bg-primary" />

        {t('due')}
      </span>

      <span className="flex items-center gap-1">
        <Check className="size-3" />

        {t('paid')}
      </span>
    </p>
  );
};

const DayBillRow: FC<Record<'expense', Expense> & Record<'href', string>> = ({
  expense,
  href
}) => {
  const t = useTranslations('calendar.day');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
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
          {t('meta', {
            origin: originLabelOf(expense, tFinances),
            category: tFinances(`categories.${category}`)
          })}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 whitespace-nowrap">
        <span className="font-medium tabular-nums">
          <Money value={amount} currency={currency} />
        </span>

        {isPartlySettled && (
          <span className="text-xs text-muted-foreground">
            {t('outstanding', {
              amount: formatMoney(outstandingAmount, currency)
            })}
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
  const t = useTranslations('calendar.day');
  const {
    formatLongWeekdayCalendarDay,
    formatMoney,
    formatWeekdayCalendarDay
  } = useFormat();
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
      ? t('nothingDue')
      : owed.length === 0
        ? t('allPaid')
        : t('leftToPay', {
            amounts: owed
              .map(({ outstanding, currency }) =>
                formatMoney(outstanding, currency)
              )
              .join(' · ')
          });

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
            <LoadingState label={t('loading')}>
              <div aria-hidden="true" className="space-y-3">
                <Skeleton className="h-10 w-full" />

                <Skeleton className="h-10 w-full" />
              </div>
            </LoadingState>
          )}

          {data === undefined && isError && (
            <ErrorState message={t('loadFailed')} onRetry={refetch} />
          )}

          {isRefetchError && (
            <StaleState isRetrying={isFetching} onRetry={refetch} />
          )}

          {data?.total === 0 && <EmptyState message={t('empty')} />}

          {data !== undefined && data.items.length > 0 && (
            <ul
              aria-label={t('list', {
                day: formatLongWeekdayCalendarDay(day) ?? day
              })}
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
              label={t('pages')}
              page={data.page}
              totalPages={data.totalPages}
              detail={t('count', { count: data.total })}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export const CalendarView: FC = () => {
  const t = useTranslations('calendar');
  const format = useFormat();
  const weekdays = weekdaysOf(format);
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

  const monthLabel = format.formatLongCalendarMonth(month) ?? month;

  const monthNavigation = (
    <nav aria-label={t('months')} className="flex items-center gap-1">
      {month !== currentMonth && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => showMonth(currentMonth)}
        >
          {t('thisMonth')}
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => showMonth(shiftCalendarMonth(month, -1))}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />

        <span className="sr-only">{t('previousMonth')}</span>
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => showMonth(shiftCalendarMonth(month, 1))}
      >
        <ChevronRight aria-hidden="true" className="size-4" />

        <span className="sr-only">{t('nextMonth')}</span>
      </Button>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

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
                <ErrorState message={t('loadFailed')} onRetry={refetch} />
              )}

              {isRefetchError && (
                <StaleState isRetrying={isFetching} onRetry={refetch} />
              )}

              {data !== undefined && (
                <>
                  <table
                    className={cn(
                      'w-full table-fixed border-separate border-spacing-0 transition-opacity',
                      isPlaceholderData && 'opacity-60'
                    )}
                  >
                    <caption className="sr-only">
                      {t('caption', { month: monthLabel })}
                    </caption>

                    <thead>
                      <tr>
                        {weekdays.map(({ short, long }) => (
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
                              <td key={weekdays[weekday].short} />
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
                      {t('nothingDueInMonth', { month: monthLabel })}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {selectedDay === null ? (
          <Card>
            <CardContent className="pt-4 sm:pt-5">
              <p className="text-sm text-muted-foreground">{t('chooseDay')}</p>
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

      <DialogPresence>
        {openBillId !== null && (
          <BillDialogs
            key={openBillId}
            expenseId={openBillId}
            onClose={closeBill}
          />
        )}
      </DialogPresence>
    </div>
  );
};
