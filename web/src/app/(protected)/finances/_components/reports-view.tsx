'use client';

import { useId, useState, type FC, type ReactNode } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import type {
  GetFinanceReportResponseData,
  ListedPayment
} from '@/app/api/v1/finances';
import {
  billDetailRoute,
  billsRouteFor,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_KIND_LABELS,
  FINANCE_LIMITS,
  PAYMENT_METHOD_LABELS
} from '@/common/constants';
import { formatMoney, updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  STALE_DATA_MESSAGE,
  StaleState
} from '@/components/data-state';
import { Money, UnavailableValue } from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import {
  useFinanceReport,
  usePayments,
  useReferenceDay
} from '@/hooks/use-finances';
import {
  calendarMonthOfDay,
  daySpanOfCalendarMonth,
  formatCalendarMonth,
  isCalendarMonth,
  monthSpanOf,
  shiftCalendarMonth
} from '@/lib/dates';
import { isNonzeroDecimal } from '@/lib/decimal';
import { FIRST_PAGE } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import {
  CategoryBars,
  FINANCE_SERIES_COLORS,
  MonthColumnChart,
  type ChartSeries
} from './finance-charts';
import {
  CurrencyPicker,
  useAdoptedCurrency,
  useCurrencyParam
} from './finance-currency';
import { CalendarDayText } from './finance-display';
import { changeTextOf, LinkedMetric } from './finance-summary';

type Report = GetFinanceReportResponseData;

type Period = Record<'from' | 'to', string>;

const PERIOD_PARAMS = { From: 'from', To: 'to' } as const;

/** The months shown by default: this one and the five before it. */
const DEFAULT_PERIOD_MONTHS = 6;

/** How far back and ahead the period can be picked: bills are added at most a year ahead. */
const PICKABLE_MONTHS_BACK = 36;
const PICKABLE_MONTHS_AHEAD = FINANCE_LIMITS.OccurrenceHorizonMonths;

const PAYMENTS_PAGE_SIZE = 20;

const PAYMENTS_SECTION_ID = 'report-payments';

const [SCHEDULED_COLOR, PAID_COLOR] = FINANCE_SERIES_COLORS;

const TREND_SERIES: ReadonlyArray<ChartSeries<'scheduled' | 'paid'>> = [
  { key: 'scheduled', label: 'Planned', color: SCHEDULED_COLOR },
  { key: 'paid', label: 'Paid', color: PAID_COLOR }
];

const COLUMN_VISIBILITY = { method: 'max-md:hidden' } as const;

const countText = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const monthText = (month: string) => formatCalendarMonth(month) ?? month;

const periodText = ({ from, to }: Period) =>
  from === to ? monthText(from) : `${monthText(from)} to ${monthText(to)}`;

/** The days a span of months covers, both counted. */
const daySpanOf = ({ from, to }: Period) => ({
  from: daySpanOfCalendarMonth(from)?.from ?? from,
  to: daySpanOfCalendarMonth(to)?.to ?? to
});

const pickableMonthsOf = (currentMonth: string) =>
  Array.from(
    { length: PICKABLE_MONTHS_BACK + PICKABLE_MONTHS_AHEAD + 1 },
    (_, index) =>
      shiftCalendarMonth(currentMonth, index - PICKABLE_MONTHS_BACK) ??
      currentMonth
  ).toReversed();

/**
 * The period the URL asks for, when it is a valid one the API accepts;
 * otherwise the last few months through this one.
 */
const periodFrom = (params: URLSearchParams, currentMonth: string): Period => {
  const from = params.get(PERIOD_PARAMS.From);
  const to = params.get(PERIOD_PARAMS.To);
  const span =
    from !== null && to !== null && isCalendarMonth(from) && isCalendarMonth(to)
      ? monthSpanOf(from, to)
      : null;

  if (
    from !== null &&
    to !== null &&
    span !== null &&
    span >= 1 &&
    span <= FINANCE_LIMITS.ReportMaxMonths
  )
    return { from, to };

  return {
    from:
      shiftCalendarMonth(currentMonth, 1 - DEFAULT_PERIOD_MONTHS) ??
      currentMonth,
    to: currentMonth
  };
};

/**
 * Moving one end past the other, or the span past the longest the API reports,
 * drags the other end along, so every pick is a period that can be shown.
 */
const periodWith = (
  period: Period,
  end: keyof Period,
  month: string
): Period => {
  const longest = FINANCE_LIMITS.ReportMaxMonths - 1;

  if (end === 'from') {
    const span = monthSpanOf(month, period.to);
    const to =
      span === null || span < 1
        ? month
        : span > FINANCE_LIMITS.ReportMaxMonths
          ? (shiftCalendarMonth(month, longest) ?? period.to)
          : period.to;

    return { from: month, to };
  }

  const span = monthSpanOf(period.from, month);
  const from =
    span === null || span < 1
      ? month
      : span > FINANCE_LIMITS.ReportMaxMonths
        ? (shiftCalendarMonth(month, -longest) ?? period.from)
        : period.from;

  return { from, to: month };
};

const MonthPicker: FC<
  Record<'label' | 'value', string> &
    Record<'months', ReadonlyArray<string>> &
    Record<'onChange', (month: string) => void>
> = ({ label, value, months, onChange }) => {
  const pickerId = useId();

  return (
    <div className="flex items-center gap-2 max-sm:flex-1">
      <Label
        htmlFor={pickerId}
        className="text-sm font-normal text-muted-foreground"
      >
        {label}
      </Label>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={pickerId} className="h-9 w-32 max-sm:flex-1">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month} value={month}>
              {monthText(month)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const ReportSection: FC<
  Record<'title', string> &
    Partial<Record<'id' | 'description' | 'className', string>> &
    Record<'children', ReactNode>
> = ({ id, title, description, children, className }) => {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn('min-w-0', className)}
    >
      <Card className="h-full">
        <SectionHeader id={headingId} title={title} description={description} />

        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
};

const PaymentRow: FC<Record<'payment', ListedPayment>> = ({ payment }) => {
  const {
    expenseId,
    description,
    category,
    currency,
    amount,
    fees,
    discount,
    paidOn,
    method
  } = payment;
  const adjustments = [
    isNonzeroDecimal(fees) && `plus ${formatMoney(fees, currency)} in fees`,
    isNonzeroDecimal(discount) &&
      `less ${formatMoney(discount, currency)} discount`
  ].filter((adjustment) => typeof adjustment === 'string');

  return (
    <TableRow>
      <TableRowHeader className="relative py-3">
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Link
            href={billDetailRoute(expenseId)}
            className="line-clamp-2 rounded-sm font-semibold ring-offset-background wrap-anywhere after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            {description}
          </Link>

          <span className="text-xs text-muted-foreground">
            {EXPENSE_CATEGORY_LABELS[category]}
          </span>
        </div>
      </TableRowHeader>

      <TableCell className="whitespace-nowrap">
        <CalendarDayText day={paidOn} />
      </TableCell>

      <TableCell className={COLUMN_VISIBILITY.method}>
        {method === null ? <UnavailableValue /> : PAYMENT_METHOD_LABELS[method]}
      </TableCell>

      <TableCell className="text-right tabular-nums">
        <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
          <span className="font-medium">
            <Money value={amount} currency={currency} />
          </span>

          {adjustments.map((adjustment) => (
            <span key={adjustment} className="text-xs text-muted-foreground">
              {adjustment}
            </span>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
};

const PaymentHistory: FC<
  Record<'currency', string> & Record<'period', Period>
> = ({ currency, period }) => {
  const [page, setPage] = useState(FIRST_PAGE);
  const days = daySpanOf(period);

  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = usePayments({
    currency,
    paidFrom: days.from,
    paidTo: days.to,
    page,
    pageSize: PAYMENTS_PAGE_SIZE
  });

  const isLoading = data === undefined && !isError;

  return (
    <div aria-busy={isLoading || isPlaceholderData} className="space-y-4">
      {isLoading && (
        <LoadingState label="Loading the payments" className="h-40" />
      )}

      {data === undefined && isError && (
        <ErrorState
          message="The payments could not be loaded"
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

      {data?.total === 0 && (
        <EmptyState message={`No payments in ${periodText(period)}`} />
      )}

      {data !== undefined && data.items.length > 0 && (
        <Table
          label="Payments table"
          className={cn(
            'transition-opacity',
            isPlaceholderData && 'opacity-60'
          )}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Bill</TableHead>

              <TableHead>Paid on</TableHead>

              <TableHead className={COLUMN_VISIBILITY.method}>Method</TableHead>

              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.items.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </TableBody>
        </Table>
      )}

      {data !== undefined && data.totalPages > 1 && (
        <div className="flex justify-end">
          <PageNavigation
            label="Payment pages"
            page={data.page}
            totalPages={data.totalPages}
            detail={countText(data.total, 'payment')}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
};

const isEmptyReport = ({ totals }: Report) =>
  totals.scheduled.count === 0 && totals.paid.count === 0;

const ReportContent: FC<Record<'report', Report>> = ({ report }) => {
  const {
    currency,
    from,
    to,
    totals,
    previous,
    change,
    months,
    categories,
    kinds
  } = report;
  const period = { from, to };
  const days = daySpanOf(period);
  const spanFilters = { currency, dueFrom: days.from, dueTo: days.to };
  const previousText = periodText(previous);

  const monthBillsRoute = (month: string, filters: Record<string, string>) => {
    const span = daySpanOfCalendarMonth(month);

    return billsRouteFor(
      span === null
        ? { currency, ...filters }
        : { currency, ...filters, dueFrom: span.from, dueTo: span.to }
    );
  };

  const adjustments = [
    isNonzeroDecimal(totals.fees) &&
      `${formatMoney(totals.fees, currency)} in fees`,
    isNonzeroDecimal(totals.discounts) &&
      `${formatMoney(totals.discounts, currency)} in discounts`
  ].filter((adjustment) => typeof adjustment === 'string');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LinkedMetric
          label="Planned"
          href={billsRouteFor(spanFilters)}
          detail={changeTextOf(change.scheduled, currency, previousText)}
        >
          <Money value={totals.scheduled.amount} currency={currency} />
        </LinkedMetric>

        <LinkedMetric
          label="Paid"
          href={`#${PAYMENTS_SECTION_ID}`}
          detail={changeTextOf(change.paid, currency, previousText)}
        >
          <Money value={totals.paid.amount} currency={currency} />
        </LinkedMetric>

        <LinkedMetric
          label="Still owed"
          href={billsRouteFor(spanFilters)}
          detail={`Of ${countText(totals.outstanding.count, 'bill')} due in the period`}
        >
          <Money value={totals.outstanding.amount} currency={currency} />
        </LinkedMetric>

        <LinkedMetric
          label="Overdue"
          href={billsRouteFor({ ...spanFilters, status: 'OVERDUE' })}
          tone={totals.overdue.count > 0 ? 'negative' : undefined}
          detail={
            totals.overdue.count === 0
              ? 'Nothing past due'
              : `${countText(totals.overdue.count, 'bill')} past due`
          }
        >
          <Money value={totals.overdue.amount} currency={currency} />
        </LinkedMetric>
      </div>

      {adjustments.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {`Payments include ${adjustments.join(' and ')}.`}
        </p>
      )}

      <ReportSection
        title="Planned and paid by month"
        description="Planned counts the bills due each month; paid counts the payments made in it, whichever month the bill was due"
      >
        <MonthColumnChart
          title="Planned and paid by month"
          currency={currency}
          layout="grouped"
          series={TREND_SERIES}
          linkLabel="Opens the bills due that month"
          columns={months.map(({ month, scheduled, paid }) => ({
            month,
            values: { scheduled, paid },
            href: monthBillsRoute(month, {})
          }))}
        />
      </ReportSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection
          title="By category"
          description="Planned in the period, and its share of the total"
        >
          {categories.length === 0 ? (
            <EmptyState message="Nothing planned in the period" />
          ) : (
            <CategoryBars
              currency={currency}
              bars={categories.map(({ category, scheduled, paid, share }) => ({
                key: category,
                label: EXPENSE_CATEGORY_LABELS[category],
                value: scheduled,
                share,
                detail: isNonzeroDecimal(paid)
                  ? `Paid ${formatMoney(paid, currency)}`
                  : undefined,
                href: billsRouteFor({ ...spanFilters, category })
              }))}
            />
          )}
        </ReportSection>

        <ReportSection
          title="By kind"
          description="One-time bills, installments and recurring expenses"
        >
          <CategoryBars
            currency={currency}
            bars={kinds.map(({ kind, scheduled, paid }) => ({
              key: kind,
              label: EXPENSE_KIND_LABELS[kind],
              value: scheduled,
              share: null,
              detail: isNonzeroDecimal(paid)
                ? `Paid ${formatMoney(paid, currency)}`
                : undefined,
              href: billsRouteFor({ ...spanFilters, kind })
            }))}
          />
        </ReportSection>
      </div>

      <ReportSection
        id={PAYMENTS_SECTION_ID}
        title="Payments"
        description={`Every payment made in ${periodText(period)}, newest first`}
        className="scroll-mt-6"
      >
        <PaymentHistory
          key={`${currency}-${from}-${to}`}
          currency={currency}
          period={period}
        />
      </ReportSection>
    </div>
  );
};

export const ReportsView: FC = () => {
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const [currency, setCurrency] = useCurrencyParam();

  const currentMonth = calendarMonthOfDay(today) ?? today.slice(0, 7);
  const period = periodFrom(searchParams, currentMonth);
  const pickableMonths = pickableMonthsOf(currentMonth);

  const reportQuery = useFinanceReport({
    ...period,
    currency: currency ?? undefined
  });
  const report = reportQuery.data;
  useAdoptedCurrency(currency, report);

  const showPeriod = (end: keyof Period, month: string) => {
    const next = periodWith(period, end, month);
    const params = new URLSearchParams(searchParams);

    params.set(PERIOD_PARAMS.From, next.from);
    params.set(PERIOD_PARAMS.To, next.to);
    updateUrlQuery(params);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={
          report === undefined
            ? periodText(period)
            : `${periodText(period)} · Amounts in ${report.currency}`
        }
      />

      <div
        role="group"
        aria-label="Report period"
        className="flex flex-wrap items-center gap-3"
      >
        <MonthPicker
          label="From"
          value={period.from}
          months={pickableMonths}
          onChange={(month) => showPeriod('from', month)}
        />

        <MonthPicker
          label="To"
          value={period.to}
          months={pickableMonths}
          onChange={(month) => showPeriod('to', month)}
        />

        {report !== undefined && (
          <CurrencyPicker
            value={report.currency}
            currencies={report.currencies}
            onChange={setCurrency}
          />
        )}
      </div>

      {report === undefined && !reportQuery.isError && (
        <LoadingState label="Loading the report" className="h-96" />
      )}

      {report === undefined && reportQuery.isError && (
        <ErrorState
          message="The report could not be loaded"
          onRetry={() => void reportQuery.refetch()}
        />
      )}

      {reportQuery.isRefetchError && (
        <StaleState
          message={STALE_DATA_MESSAGE}
          isRetrying={reportQuery.isFetching}
          onRetry={() => void reportQuery.refetch()}
        />
      )}

      {report !== undefined && isEmptyReport(report) && (
        <EmptyState
          message={`Nothing was due or paid in ${report.currency} in ${periodText(report)}`}
        />
      )}

      {report !== undefined && !isEmptyReport(report) && (
        <div
          aria-busy={reportQuery.isPlaceholderData}
          className={cn(
            'transition-opacity',
            reportQuery.isPlaceholderData && 'opacity-60'
          )}
        >
          <ReportContent report={report} />
        </div>
      )}
    </div>
  );
};
