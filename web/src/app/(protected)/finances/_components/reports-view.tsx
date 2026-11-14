'use client';

import { useId, useMemo, useState, type FC, type ReactNode } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useTranslations } from 'use-intl';

import type {
  GetFinanceReportResponseData,
  ListedPayment
} from '@/app/api/v1/finances';
import {
  billDetailRoute,
  billsRouteFor,
  FINANCE_LIMITS
} from '@/common/constants';
import { updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
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
import { useFormat, type Format } from '@/i18n/format';
import type { Translator } from '@/i18n/translator';
import {
  calendarMonthOfDay,
  daySpanOfCalendarMonth,
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

type ReportsTranslator = Translator<'reports'>;

const PERIOD_PARAMS = { From: 'from', To: 'to' } as const;

const DEFAULT_PERIOD_MONTHS = 6;

const PICKABLE_MONTHS_BACK = 36;
const PICKABLE_MONTHS_AHEAD = FINANCE_LIMITS.OccurrenceHorizonMonths;

const PAYMENTS_PAGE_SIZE = 20;

const PAYMENTS_SECTION_ID = 'report-payments';

const [SCHEDULED_COLOR, PAID_COLOR] = FINANCE_SERIES_COLORS;

const COLUMN_VISIBILITY = { method: 'max-md:hidden' } as const;

const monthText = (month: string, { formatCalendarMonth }: Format) =>
  formatCalendarMonth(month) ?? month;

const periodTextOf = (
  { from, to }: Period,
  form: 'period' | 'span' | 'comparedTo',
  t: ReportsTranslator,
  format: Format
) =>
  t(form, {
    kind: from === to ? 'month' : 'range',
    from: monthText(from, format),
    to: monthText(to, format)
  });

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
  const format = useFormat();
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
        <SelectTrigger
          id={pickerId}
          className="h-(--control-height) w-32 max-sm:flex-1"
        >
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month} value={month}>
              {monthText(month, format)}
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
  const t = useTranslations('reports.payments');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
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
    isNonzeroDecimal(fees) &&
      t('fees', { amount: formatMoney(fees, currency) }),
    isNonzeroDecimal(discount) &&
      t('discount', { amount: formatMoney(discount, currency) })
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
            {tFinances(`categories.${category}`)}
          </span>
        </div>
      </TableRowHeader>

      <TableCell className="whitespace-nowrap">
        <CalendarDayText day={paidOn} />
      </TableCell>

      <TableCell className={COLUMN_VISIBILITY.method}>
        {method === null ? (
          <UnavailableValue />
        ) : (
          tFinances(`paymentMethods.${method}`)
        )}
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
  const t = useTranslations('reports.payments');
  const tReports = useTranslations('reports');
  const format = useFormat();
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
      {isLoading && <LoadingState label={t('loading')} className="h-40" />}

      {data === undefined && isError && (
        <ErrorState message={t('loadFailed')} onRetry={refetch} />
      )}

      {isRefetchError && (
        <StaleState isRetrying={isFetching} onRetry={refetch} />
      )}

      {data?.total === 0 && (
        <EmptyState
          message={t('empty', {
            span: periodTextOf(period, 'span', tReports, format)
          })}
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
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('columns.bill')}</TableHead>

              <TableHead>{t('columns.paidOn')}</TableHead>

              <TableHead className={COLUMN_VISIBILITY.method}>
                {t('columns.method')}
              </TableHead>

              <TableHead className="text-right">
                {t('columns.amount')}
              </TableHead>
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
            label={t('pages')}
            page={data.page}
            totalPages={data.totalPages}
            detail={t('count', { count: data.total })}
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
  const t = useTranslations('reports');
  const tSummary = useTranslations('finances.summary');
  const tFinances = useTranslations('finances');
  const format = useFormat();
  const { formatList, formatMoney } = format;
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
  const previousText = periodTextOf(previous, 'comparedTo', t, format);
  const trendSeries = useMemo<ReadonlyArray<ChartSeries<'scheduled' | 'paid'>>>(
    () => [
      { key: 'scheduled', label: t('trend.planned'), color: SCHEDULED_COLOR },
      { key: 'paid', label: t('trend.paid'), color: PAID_COLOR }
    ],
    [t]
  );

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
      t('adjustmentFees', { amount: formatMoney(totals.fees, currency) }),
    isNonzeroDecimal(totals.discounts) &&
      t('adjustmentDiscounts', {
        amount: formatMoney(totals.discounts, currency)
      })
  ].filter((adjustment) => typeof adjustment === 'string');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LinkedMetric
          label={t('metrics.planned')}
          href={billsRouteFor(spanFilters)}
          detail={changeTextOf(
            change.scheduled,
            currency,
            previousText,
            tSummary,
            format
          )}
        >
          <Money value={totals.scheduled.amount} currency={currency} />
        </LinkedMetric>

        <LinkedMetric
          label={t('metrics.paid')}
          href={`#${PAYMENTS_SECTION_ID}`}
          detail={changeTextOf(
            change.paid,
            currency,
            previousText,
            tSummary,
            format
          )}
        >
          <Money value={totals.paid.amount} currency={currency} />
        </LinkedMetric>

        <LinkedMetric
          label={t('metrics.owed')}
          href={billsRouteFor(spanFilters)}
          detail={t('metrics.owedDetail', {
            count: totals.outstanding.count
          })}
        >
          <Money value={totals.outstanding.amount} currency={currency} />
        </LinkedMetric>

        <LinkedMetric
          label={t('metrics.overdue')}
          href={billsRouteFor({ ...spanFilters, status: 'OVERDUE' })}
          tone={totals.overdue.count > 0 ? 'negative' : undefined}
          detail={
            totals.overdue.count === 0
              ? t('metrics.nothingOverdue')
              : t('metrics.overdueDetail', { count: totals.overdue.count })
          }
        >
          <Money value={totals.overdue.amount} currency={currency} />
        </LinkedMetric>
      </div>

      {adjustments.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('adjustments', { items: formatList(adjustments) })}
        </p>
      )}

      <ReportSection
        title={t('trend.title')}
        description={t('trend.description')}
      >
        <MonthColumnChart
          title={t('trend.title')}
          currency={currency}
          layout="grouped"
          series={trendSeries}
          linkLabel={t('trend.link')}
          columns={months.map(({ month, scheduled, paid }) => ({
            month,
            values: { scheduled, paid },
            href: monthBillsRoute(month, {})
          }))}
        />
      </ReportSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportSection
          title={t('categories.title')}
          description={t('categories.description')}
        >
          {categories.length === 0 ? (
            <EmptyState message={t('categories.empty')} />
          ) : (
            <CategoryBars
              currency={currency}
              bars={categories.map(({ category, scheduled, paid, share }) => ({
                key: category,
                label: tFinances(`categories.${category}`),
                value: scheduled,
                share,
                detail: isNonzeroDecimal(paid)
                  ? t('paidDetail', { amount: formatMoney(paid, currency) })
                  : undefined,
                href: billsRouteFor({ ...spanFilters, category })
              }))}
            />
          )}
        </ReportSection>

        <ReportSection
          title={t('kinds.title')}
          description={t('kinds.description')}
        >
          <CategoryBars
            currency={currency}
            bars={kinds.map(({ kind, scheduled, paid }) => ({
              key: kind,
              label: tFinances(`kinds.${kind}`),
              value: scheduled,
              share: null,
              detail: isNonzeroDecimal(paid)
                ? t('paidDetail', { amount: formatMoney(paid, currency) })
                : undefined,
              href: billsRouteFor({ ...spanFilters, kind })
            }))}
          />
        </ReportSection>
      </div>

      <ReportSection
        id={PAYMENTS_SECTION_ID}
        title={t('payments.title')}
        description={t('payments.description', {
          span: periodTextOf(period, 'span', t, format)
        })}
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
  const t = useTranslations('reports');
  const format = useFormat();
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
        title={t('title')}
        description={
          report === undefined
            ? periodTextOf(period, 'period', t, format)
            : t('headerWithCurrency', {
                period: periodTextOf(period, 'period', t, format),
                currency: report.currency
              })
        }
      />

      <div
        role="group"
        aria-label={t('periodGroup')}
        className="flex flex-wrap items-center gap-3"
      >
        <MonthPicker
          label={t('from')}
          value={period.from}
          months={pickableMonths}
          onChange={(month) => showPeriod('from', month)}
        />

        <MonthPicker
          label={t('to')}
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
        <LoadingState label={t('loading')} className="h-96" />
      )}

      {report === undefined && reportQuery.isError && (
        <ErrorState
          message={t('loadFailed')}
          onRetry={() => void reportQuery.refetch()}
        />
      )}

      {reportQuery.isRefetchError && (
        <StaleState
          isRetrying={reportQuery.isFetching}
          onRetry={() => void reportQuery.refetch()}
        />
      )}

      {report !== undefined && isEmptyReport(report) && (
        <EmptyState
          message={t('empty', {
            currency: report.currency,
            span: periodTextOf(report, 'span', t, format)
          })}
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
