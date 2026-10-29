'use client';

import { useMemo, useState, type FC, type ReactNode } from 'react';

import Link from 'next/link';

import { BellRing, Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  Expense,
  FinanceSettings,
  GetFinanceSummaryResponseData
} from '@/app/api/v1/finances';
import { APP_ROUTES, billDetailRoute, billsRouteFor } from '@/common/constants';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { HEADLINE_VALUE_CLASS, Money } from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent } from '@/components/ui';
import {
  useCreateExpense,
  useFinanceSettings,
  useFinanceSummary,
  useUpdateFinanceSettings
} from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { daySpanOfCalendarMonth, shiftCalendarDay } from '@/lib/dates';
import { isNonzeroDecimal } from '@/lib/decimal';

import { ExpenseFormDialog } from './expense-form-dialog';
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
import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  originLabelOf
} from './finance-display';
import { AlertTotals, changeTextOf, LinkedMetric } from './finance-summary';
import { ReminderSettingsDialog } from './reminder-settings-dialog';

type Summary = GetFinanceSummaryResponseData;

const [SCHEDULED_COLOR, PAID_COLOR, RECURRING_COLOR] = FINANCE_SERIES_COLORS;

const remindsUpcoming = (reminders: FinanceSettings) =>
  reminders.remindUpcomingBills || reminders.remindUpcomingInstallments;

/** What the reminders flag, as catalog keys. */
const remindedOf = (reminders: FinanceSettings) =>
  [
    reminders.remindOverdue && ('overdue' as const),
    reminders.remindUpcomingBills && ('bills' as const),
    reminders.remindUpcomingInstallments && ('installments' as const)
  ].filter((item) => item !== false);

const capitalize = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const monthBillsRoute = (month: string, filters: Record<string, string>) => {
  const span = daySpanOfCalendarMonth(month);

  return billsRouteFor(
    span === null ? filters : { ...filters, dueFrom: span.from, dueTo: span.to }
  );
};

const reportRouteFor = (month: string, currency: string) =>
  `${APP_ROUTES.Protected.FinanceReports}?${new URLSearchParams({ from: month, to: month, currency })}`;

const isEmptySummary = ({
  outstanding,
  overdue,
  current,
  trend,
  commitments,
  upcoming,
  installments,
  recurring
}: Summary) =>
  outstanding.count === 0 &&
  overdue.count === 0 &&
  current.scheduled.count === 0 &&
  upcoming.length === 0 &&
  installments.activePlans === 0 &&
  recurring.activeSeries === 0 &&
  trend.every(
    ({ scheduled, paid }) =>
      !isNonzeroDecimal(scheduled) && !isNonzeroDecimal(paid)
  ) &&
  commitments.every(({ total }) => !isNonzeroDecimal(total));

const MonthMetrics: FC<Record<'summary', Summary>> = ({ summary }) => {
  const t = useTranslations('financeOverview.metrics');
  const tSummary = useTranslations('finances.summary');
  const format = useFormat();
  const { currency, month, current, outstanding, overdue, change } = summary;
  const filters = { currency };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <LinkedMetric
        label={t('outstanding')}
        href={billsRouteFor({ ...filters, status: 'OPEN' })}
        className="sm:col-span-2 xl:col-span-1"
        detail={
          outstanding.count === 0
            ? t('nothingOwed')
            : t('outstandingDetail', { count: outstanding.count })
        }
      >
        <Money value={outstanding.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label={t('owedThisMonth')}
        href={monthBillsRoute(month, filters)}
        detail={t('bills', { count: current.outstanding.count })}
      >
        <Money value={current.outstanding.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label={t('overdue')}
        href={billsRouteFor({ ...filters, status: 'OVERDUE' })}
        tone={overdue.count > 0 ? 'negative' : undefined}
        detail={
          overdue.count === 0
            ? t('nothingOverdue')
            : t('overdueDetail', { count: overdue.count })
        }
      >
        <Money value={overdue.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label={t('paidThisMonth')}
        href={reportRouteFor(month, currency)}
        detail={changeTextOf(
          change.paid,
          currency,
          'lastMonth',
          tSummary,
          format
        )}
      >
        <Money value={current.paid.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label={t('plannedThisMonth')}
        href={monthBillsRoute(month, filters)}
        detail={changeTextOf(
          change.scheduled,
          currency,
          'lastMonth',
          tSummary,
          format
        )}
      >
        <Money value={current.scheduled.amount} currency={currency} />
      </LinkedMetric>
    </div>
  );
};

const UpcomingBill: FC<
  Record<'expense', Expense> & Record<'today', string>
> = ({ expense, today }) => {
  const tFinances = useTranslations('finances');
  const details = [
    dueDistanceOf(expense.dueDate, today, tFinances),
    originLabelOf(expense, tFinances)
  ].filter((detail) => detail !== null);

  return (
    <li>
      <Link
        href={billDetailRoute(expense.id)}
        className="flex items-start justify-between gap-3 rounded-md px-2 py-2.5 ring-offset-background outline-hidden hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="min-w-0 space-y-0.5">
          <span className="block truncate text-sm font-medium">
            {expense.description}
          </span>

          <span className="block text-xs text-muted-foreground">
            <CalendarDayText day={expense.dueDate} />

            {details.map((detail) => (
              <span key={detail}>
                {' · '}

                {detail}
              </span>
            ))}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-medium tabular-nums">
            <Money
              value={expense.outstandingAmount}
              currency={expense.currency}
            />
          </span>

          <ExpenseStatusBadge status={expense.status} />
        </span>
      </Link>
    </li>
  );
};

const UpcomingBills: FC<Record<'summary', Summary>> = ({ summary }) => {
  const t = useTranslations('financeOverview.upcoming');

  return (
    <section aria-labelledby="finance-upcoming" className="h-full min-w-0">
      <Card className="h-full">
        <SectionHeader
          id="finance-upcoming"
          title={t('title')}
          action={
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link
                href={billsRouteFor({
                  currency: summary.currency,
                  status: 'PENDING'
                })}
              >
                {t('allPending')}
              </Link>
            </Button>
          }
        />

        <CardContent>
          {summary.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('empty', { currency: summary.currency })}
            </p>
          ) : (
            <ul className="-mx-2 divide-y">
              {summary.upcoming.map((expense) => (
                <UpcomingBill
                  key={expense.id}
                  expense={expense}
                  today={summary.today}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

const ChartCard: FC<
  Record<'id' | 'title', string> &
    Partial<Record<'description', string>> &
    Record<'children', ReactNode>
> = ({ id, title, description, children }) => (
  <section aria-labelledby={id} className="min-w-0">
    <Card className="h-full">
      <SectionHeader id={id} title={title} description={description} />

      <CardContent>{children}</CardContent>
    </Card>
  </section>
);

const CommitmentSummaries: FC<
  Record<'summary', Summary> & Record<'onEditReminders', VoidFunction>
> = ({ summary, onEditReminders }) => {
  const t = useTranslations('financeOverview');
  const tFinances = useTranslations('finances');
  const { formatList } = useFormat();
  const { currency, installments, recurring, reminders } = summary;
  const reminded = remindedOf(reminders).map((item) =>
    t(`reminders.items.${item}`)
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <SectionHeader
          id="finance-installments"
          title={t('installments.title')}
          action={
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href={APP_ROUTES.Protected.FinanceInstallments}>
                {t('installments.link')}
              </Link>
            </Button>
          }
        />

        <CardContent className="space-y-1">
          <p className={HEADLINE_VALUE_CLASS}>
            <Money value={installments.outstanding} currency={currency} />
          </p>

          <p className="text-sm text-muted-foreground">
            {installments.activePlans === 0
              ? t('installments.none')
              : t('installments.detail', {
                  plans: installments.activePlans,
                  installments: installments.openInstallments
                })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          id="finance-recurring"
          title={t('recurring.title')}
          action={
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href={APP_ROUTES.Protected.FinanceRecurring}>
                {t('recurring.link')}
              </Link>
            </Button>
          }
        />

        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className={HEADLINE_VALUE_CLASS}>
              <Money value={recurring.monthlyEquivalent} currency={currency} />
            </p>

            <p className="text-sm text-muted-foreground">
              {recurring.activeSeries === 0
                ? t('recurring.none')
                : t('recurring.detail', { count: recurring.activeSeries })}
            </p>
          </div>

          {recurring.series.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {recurring.series.slice(0, 4).map((series) => (
                <li
                  key={series.id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate">
                    {series.description}

                    <span className="text-xs text-muted-foreground">
                      {' · '}

                      {tFinances(`frequencies.${series.frequency}`)}
                    </span>
                  </span>

                  <span className="shrink-0 tabular-nums">
                    <Money value={series.amount} currency={series.currency} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          id="finance-reminders"
          title={t('reminders.title')}
          action={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={onEditReminders}
            >
              {t('reminders.change')}
            </Button>
          }
        />

        <CardContent className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <BellRing
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />

            {reminded.length === 0
              ? t('reminders.off')
              : !remindsUpcoming(reminders)
                ? t('reminders.overdueOnly')
                : reminders.reminderLeadDays === 0
                  ? t('reminders.onDueDay')
                  : t('reminders.leadDays', {
                      days: reminders.reminderLeadDays
                    })}
          </p>

          <p className="text-sm text-muted-foreground">
            {[
              reminded.length === 0
                ? t('reminders.nothingFlagged')
                : t('reminders.flagged', {
                    items: capitalize(formatList(reminded))
                  }),
              t('reminders.noExternal')
            ].join(' ')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryContent: FC<
  Record<'summary', Summary> & Record<'onEditReminders', VoidFunction>
> = ({ summary, onEditReminders }) => {
  const t = useTranslations('financeOverview');
  const tAlerts = useTranslations('bills.alerts');
  const tFinances = useTranslations('finances');
  const { formatLongCalendarMonth, formatMoney } = useFormat();
  const {
    currency,
    month,
    today,
    overdue,
    dueSoon,
    reminders,
    trend,
    commitments,
    categories
  } = summary;
  const monthName = formatLongCalendarMonth(month) ?? month;
  const { reminderLeadDays } = reminders;
  const dueSoonTo = shiftCalendarDay(today, reminderLeadDays) ?? today;
  const showsOverdue = reminders.remindOverdue && overdue.count > 0;
  const trendSeries = useMemo<ReadonlyArray<ChartSeries<'scheduled' | 'paid'>>>(
    () => [
      { key: 'scheduled', label: t('trend.planned'), color: SCHEDULED_COLOR },
      { key: 'paid', label: t('trend.paid'), color: PAID_COLOR }
    ],
    [t]
  );
  const commitmentSeries = useMemo<
    ReadonlyArray<ChartSeries<'oneTime' | 'installments' | 'recurring'>>
  >(
    () => [
      {
        key: 'oneTime',
        label: t('commitments.oneTime'),
        color: SCHEDULED_COLOR
      },
      {
        key: 'installments',
        label: t('commitments.installments'),
        color: PAID_COLOR
      },
      {
        key: 'recurring',
        label: t('commitments.recurring'),
        color: RECURRING_COLOR
      }
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      {(showsOverdue || dueSoon.count > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {showsOverdue && (
            <AlertTotals
              tone="negative"
              title={tAlerts('overdue', { count: overdue.count })}
              totals={[{ currency, amount: overdue.amount }]}
              href={billsRouteFor({ currency, status: 'OVERDUE' })}
            />
          )}

          {dueSoon.count > 0 && (
            <AlertTotals
              tone="warning"
              title={tAlerts('dueSoon', {
                count: dueSoon.count,
                days: reminderLeadDays
              })}
              totals={[{ currency, amount: dueSoon.amount }]}
              href={billsRouteFor({
                currency,
                status: 'PENDING',
                dueFrom: today,
                dueTo: dueSoonTo,
                ...(reminders.remindUpcomingBills
                  ? {}
                  : { kind: 'INSTALLMENT' })
              })}
            />
          )}
        </div>
      )}

      <MonthMetrics summary={summary} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartCard
            id="finance-trend"
            title={t('trend.title')}
            description={t('trend.description', {
              count: trend.length,
              currency
            })}
          >
            <MonthColumnChart
              title={t('trend.chartTitle')}
              currency={currency}
              layout="grouped"
              series={trendSeries}
              linkLabel={t('trend.link')}
              columns={trend.map(({ month: trendMonth, scheduled, paid }) => ({
                month: trendMonth,
                values: { scheduled, paid },
                href: monthBillsRoute(trendMonth, { currency })
              }))}
            />
          </ChartCard>
        </div>

        <div className="xl:col-span-2">
          <UpcomingBills summary={summary} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          id="finance-commitments"
          title={t('commitments.title')}
          description={t('commitments.description', { month: monthName })}
        >
          <MonthColumnChart
            title={t('commitments.chartTitle')}
            currency={currency}
            layout="stacked"
            series={commitmentSeries}
            linkLabel={t('trend.link')}
            columns={commitments.map(
              ({
                month: commitmentMonth,
                oneTime,
                installments,
                recurring
              }) => ({
                month: commitmentMonth,
                values: { oneTime, installments, recurring },
                href: monthBillsRoute(commitmentMonth, { currency })
              })
            )}
          />
        </ChartCard>

        <ChartCard
          id="finance-categories"
          title={t('categories.title')}
          description={t('categories.description', {
            month: monthName,
            currency
          })}
        >
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('categories.empty')}
            </p>
          ) : (
            <CategoryBars
              currency={currency}
              bars={categories.map(({ category, scheduled, paid, share }) => ({
                key: category,
                label: tFinances(`categories.${category}`),
                value: scheduled,
                share,
                detail: isNonzeroDecimal(paid)
                  ? t('categories.paid', {
                      amount: formatMoney(paid, currency)
                    })
                  : undefined,
                href: monthBillsRoute(month, { currency, category })
              }))}
            />
          )}
        </ChartCard>
      </div>

      <CommitmentSummaries
        summary={summary}
        onEditReminders={onEditReminders}
      />
    </div>
  );
};

export const OverviewView: FC = () => {
  const t = useTranslations('financeOverview');
  const { formatLongCalendarMonth } = useFormat();
  const [currency, setCurrency] = useCurrencyParam();
  const summaryQuery = useFinanceSummary(currency);
  const settingsQuery = useFinanceSettings();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingReminders, setIsEditingReminders] = useState(false);

  const { mutateAsync: createExpense } = useCreateExpense();
  const { mutateAsync: updateSettings } = useUpdateFinanceSettings();

  const summary = summaryQuery.data;
  useAdoptedCurrency(currency, summary);

  const settings = settingsQuery.data ?? summary?.reminders;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={
          summary === undefined
            ? undefined
            : t('headerDescription', {
                month: formatLongCalendarMonth(summary.month) ?? summary.month,
                currency: summary.currency
              })
        }
        isPending={summary === undefined && !summaryQuery.isError}
        action={
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            {summary !== undefined && (
              <CurrencyPicker
                value={summary.currency}
                currencies={summary.currencies}
                onChange={setCurrency}
              />
            )}

            <Button
              size="sm"
              className="gap-1.5 max-sm:flex-1"
              onClick={() => setIsAdding(true)}
            >
              <Plus size={16} aria-hidden="true" />

              {t('add')}
            </Button>
          </div>
        }
      />

      {summary === undefined && !summaryQuery.isError && (
        <LoadingState label={t('loading')} className="h-96" />
      )}

      {summary === undefined && summaryQuery.isError && (
        <ErrorState
          message={t('loadFailed')}
          onRetry={() => void summaryQuery.refetch()}
        />
      )}

      {summary !== undefined && isEmptySummary(summary) && (
        <EmptyState
          message={
            summary.currencies.length === 0
              ? t('emptyAll')
              : t('emptyCurrency', { currency: summary.currency })
          }
          action={{ label: t('add'), onSelect: () => setIsAdding(true) }}
        />
      )}

      {summary !== undefined && !isEmptySummary(summary) && (
        <SummaryContent
          summary={summary}
          onEditReminders={() => setIsEditingReminders(true)}
        />
      )}

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

      {isEditingReminders && settings !== undefined && (
        <ReminderSettingsDialog
          settings={settings}
          onCancel={() => setIsEditingReminders(false)}
          onSubmit={async (next) => {
            await updateSettings(next);
            setIsEditingReminders(false);
          }}
        />
      )}
    </div>
  );
};
