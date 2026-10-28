'use client';

import { useState, type FC, type ReactNode } from 'react';

import Link from 'next/link';

import { BellRing, Plus } from 'lucide-react';

import type {
  Expense,
  FinanceSettings,
  GetFinanceSummaryResponseData
} from '@/app/api/v1/finances';
import {
  APP_ROUTES,
  billDetailRoute,
  billsRouteFor,
  EXPENSE_CATEGORY_LABELS,
  RECURRENCE_FREQUENCY_LABELS
} from '@/common/constants';
import { formatMoney } from '@/common/utils';
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
import {
  daySpanOfCalendarMonth,
  formatLongCalendarMonth,
  shiftCalendarDay
} from '@/lib/dates';
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

const TREND_SERIES: ReadonlyArray<ChartSeries<'scheduled' | 'paid'>> = [
  { key: 'scheduled', label: 'Planned', color: SCHEDULED_COLOR },
  { key: 'paid', label: 'Paid', color: PAID_COLOR }
];

const COMMITMENT_SERIES: ReadonlyArray<
  ChartSeries<'oneTime' | 'installments' | 'recurring'>
> = [
  { key: 'oneTime', label: 'One-time', color: SCHEDULED_COLOR },
  { key: 'installments', label: 'Installments', color: PAID_COLOR },
  { key: 'recurring', label: 'Recurring', color: RECURRING_COLOR }
];

const countText = (count: number, noun: string, plural = `${noun}s`) =>
  `${count} ${count === 1 ? noun : plural}`;

const REMINDED_LIST = new Intl.ListFormat('en', { type: 'conjunction' });

const remindsUpcoming = (reminders: FinanceSettings) =>
  reminders.remindUpcomingBills || reminders.remindUpcomingInstallments;

/** What the reminders flag, in words. */
const remindedOf = (reminders: FinanceSettings) =>
  [
    reminders.remindOverdue && 'overdue bills',
    reminders.remindUpcomingBills && 'bills due soon',
    reminders.remindUpcomingInstallments && 'installments due soon'
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
  const { currency, month, current, outstanding, overdue, change } = summary;
  const filters = { currency };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <LinkedMetric
        label="Total outstanding"
        href={billsRouteFor({ ...filters, status: 'OPEN' })}
        className="sm:col-span-2 xl:col-span-1"
        detail={
          outstanding.count === 0
            ? 'Nothing owed'
            : `${countText(outstanding.count, 'bill')}, whenever due; recurring ones through this month`
        }
      >
        <Money value={outstanding.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label="Still owed this month"
        href={monthBillsRoute(month, filters)}
        detail={countText(current.outstanding.count, 'bill')}
      >
        <Money value={current.outstanding.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label="Overdue"
        href={billsRouteFor({ ...filters, status: 'OVERDUE' })}
        tone={overdue.count > 0 ? 'negative' : undefined}
        detail={
          overdue.count === 0
            ? 'Nothing past due'
            : `${countText(overdue.count, 'bill')} past due, from any month`
        }
      >
        <Money value={overdue.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label="Paid this month"
        href={reportRouteFor(month, currency)}
        detail={changeTextOf(change.paid, currency, 'last month')}
      >
        <Money value={current.paid.amount} currency={currency} />
      </LinkedMetric>

      <LinkedMetric
        label="Planned this month"
        href={monthBillsRoute(month, filters)}
        detail={changeTextOf(change.scheduled, currency, 'last month')}
      >
        <Money value={current.scheduled.amount} currency={currency} />
      </LinkedMetric>
    </div>
  );
};

const UpcomingBill: FC<
  Record<'expense', Expense> & Record<'today', string>
> = ({ expense, today }) => (
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

          {` · ${dueDistanceOf(expense.dueDate, today) ?? ''} · ${originLabelOf(expense)}`}
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

const UpcomingBills: FC<Record<'summary', Summary>> = ({ summary }) => (
  <section aria-labelledby="finance-upcoming" className="h-full min-w-0">
    <Card className="h-full">
      <SectionHeader
        id="finance-upcoming"
        title="Next bills"
        action={
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link
              href={billsRouteFor({
                currency: summary.currency,
                status: 'PENDING'
              })}
            >
              All pending
            </Link>
          </Button>
        }
      />

      <CardContent>
        {summary.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing pending in {summary.currency}
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
  const { currency, installments, recurring, reminders } = summary;
  const reminded = remindedOf(reminders);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <SectionHeader
          id="finance-installments"
          title="Installments"
          action={
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href={APP_ROUTES.Protected.FinanceInstallments}>
                View plans
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
              ? 'No active plan'
              : `Left to pay on ${countText(installments.activePlans, 'active plan')}, in ${countText(installments.openInstallments, 'installment')}`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <SectionHeader
          id="finance-recurring"
          title="Recurring"
          action={
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link href={APP_ROUTES.Protected.FinanceRecurring}>
                View series
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
                ? 'No active series'
                : `A month, across ${countText(recurring.activeSeries, 'active series', 'active series')}`}
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
                      {` · ${RECURRENCE_FREQUENCY_LABELS[series.frequency]}`}
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
          title="Reminders"
          action={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={onEditReminders}
            >
              Change
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
              ? 'Off'
              : !remindsUpcoming(reminders)
                ? 'Overdue bills only'
                : reminders.reminderLeadDays === 0
                  ? 'On the due day'
                  : `${countText(reminders.reminderLeadDays, 'day')} before the due date`}
          </p>

          <p className="text-sm text-muted-foreground">
            {reminded.length === 0
              ? 'Nothing is flagged on this page or in the navigation.'
              : `${capitalize(REMINDED_LIST.format(reminded))} are flagged on this page and in the navigation.`}{' '}
            No email or push notification is sent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const SummaryContent: FC<
  Record<'summary', Summary> & Record<'onEditReminders', VoidFunction>
> = ({ summary, onEditReminders }) => {
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

  return (
    <div className="space-y-6">
      {(showsOverdue || dueSoon.count > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {showsOverdue && (
            <AlertTotals
              tone="negative"
              title={`${countText(overdue.count, 'bill')} overdue`}
              totals={[{ currency, amount: overdue.amount }]}
              href={billsRouteFor({ currency, status: 'OVERDUE' })}
            />
          )}

          {dueSoon.count > 0 && (
            <AlertTotals
              tone="warning"
              title={`${countText(dueSoon.count, 'bill')} due ${reminderLeadDays === 0 ? 'today' : `within ${countText(reminderLeadDays, 'day')}`}`}
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
            title="Planned and paid"
            description={`The last ${trend.length} months, in ${currency}. Planned is what fell due; paid is the cash that left, by payment day.`}
          >
            <MonthColumnChart
              title="Planned and paid by month"
              currency={currency}
              layout="grouped"
              series={TREND_SERIES}
              linkLabel="Opens the bills due that month"
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
          title="Coming months"
          description={`What is due from ${monthName} on, by kind. Recurring months show only the occurrences already scheduled.`}
        >
          <MonthColumnChart
            title="Commitments by month"
            currency={currency}
            layout="stacked"
            series={COMMITMENT_SERIES}
            linkLabel="Opens the bills due that month"
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
          title="By category"
          description={`Planned for ${monthName}, in ${currency}`}
        >
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing planned this month
            </p>
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
        title="Finances"
        description={
          summary === undefined
            ? undefined
            : `${formatLongCalendarMonth(summary.month) ?? summary.month} · Amounts in ${summary.currency}`
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
              Add bill
            </Button>
          </div>
        }
      />

      {summary === undefined && !summaryQuery.isError && (
        <LoadingState label="Loading your finances" className="h-96" />
      )}

      {summary === undefined && summaryQuery.isError && (
        <ErrorState
          message="Your finances could not be loaded"
          onRetry={() => void summaryQuery.refetch()}
        />
      )}

      {summary !== undefined && isEmptySummary(summary) && (
        <EmptyState
          message={
            summary.currencies.length === 0
              ? 'No bills yet. Add one, an installment purchase or a recurring expense to see them here.'
              : `No bills in ${summary.currency}`
          }
          action={{ label: 'Add bill', onSelect: () => setIsAdding(true) }}
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
