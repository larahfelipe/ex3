import { useId, useState, type FC } from 'react';

import Link from 'next/link';

import { useTranslations } from 'use-intl';

import type { Expense, RecurringExpenseDetail } from '@/app/api/v1/finances';
import { billDetailRoute } from '@/common/constants';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleState
} from '@/components/data-state';
import {
  Metric,
  Money,
  PROMINENT_VALUE_CLASS,
  UnavailableValue
} from '@/components/financial';
import { PageNavigation } from '@/components/page-navigation';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  SegmentedControlItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import {
  useCancelRecurringExpense,
  useDeleteRecurringExpense,
  useExpenses,
  useRecordPayment,
  useRecurringExpense,
  useReferenceDay,
  useUpdateRecurringExpense
} from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import { shiftCalendarDay } from '@/lib/dates';
import { isNonzeroDecimal } from '@/lib/decimal';
import { FIRST_PAGE } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  FinanceHistory,
  isOpenExpense,
  SeriesStatusBadge
} from './finance-display';
import { PaymentFormDialog } from './payment-form-dialog';
import { EditSeriesDialog, StopSeriesDialog } from './recurring-expense-forms';

type SeriesDialogsProps = Record<'seriesId', string | null> &
  Record<'onClose', VoidFunction>;

type SeriesAction =
  | Record<'kind', 'details' | 'edit' | 'stop' | 'delete'>
  | (Record<'kind', 'pay'> & Record<'occurrence', Expense>);

type SeriesDetailsProps = Record<'series', RecurringExpenseDetail> &
  Record<'onAction', (action: SeriesAction) => void>;

type OccurrenceView = (typeof OCCURRENCE_VIEWS)[number];

const OCCURRENCE_VIEWS = ['upcoming', 'earlier'] as const;

const OCCURRENCES_PAGE_SIZE = 10;

const COLUMN_VISIBILITY = { status: 'max-sm:hidden' } as const;

/** Upcoming bills run from today forward, earlier ones from yesterday back. */
const occurrenceFiltersOf = (view: OccurrenceView, today: string) =>
  view === 'upcoming'
    ? { dueFrom: today, sortOrder: 'asc' as const }
    : {
        dueTo: shiftCalendarDay(today, -1) ?? today,
        sortOrder: 'desc' as const
      };

const OccurrenceRow: FC<
  Record<'occurrence', Expense> &
    Record<'today', string> &
    Record<'onPay', VoidFunction>
> = ({ occurrence, today, onPay }) => {
  const t = useTranslations('recurring.occurrences');
  const tFinances = useTranslations('finances');
  const { formatCalendarDay, formatMoney } = useFormat();
  const {
    id,
    dueDate,
    amount,
    outstandingAmount,
    settledAmount,
    currency,
    status,
    isCustomized
  } = occurrence;
  const isOpen = isOpenExpense(occurrence);
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today, tFinances) : null;
  const day = formatCalendarDay(dueDate) ?? dueDate;

  return (
    <TableRow>
      <TableRowHeader className="py-2.5">
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-medium whitespace-nowrap">
            <CalendarDayText day={dueDate} />
          </span>

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

          {isCustomized && (
            <span className="text-xs text-muted-foreground">
              {t('customized')}
            </span>
          )}

          <ExpenseStatusBadge status={status} className="sm:hidden" />
        </div>
      </TableRowHeader>

      <TableCell className="text-right whitespace-nowrap tabular-nums">
        <div className="flex flex-col items-end gap-0.5">
          <Money value={amount} currency={currency} />

          {isOpen && isNonzeroDecimal(settledAmount) && (
            <span className="text-xs text-muted-foreground">
              {t('outstanding', {
                amount: formatMoney(outstandingAmount, currency)
              })}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className={cn('text-right', COLUMN_VISIBILITY.status)}>
        <ExpenseStatusBadge status={status} />
      </TableCell>

      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {isOpen && (
            <Button variant="outline" size="xs" onClick={onPay}>
              {t.rich('pay', { day, hidden: srOnly })}
            </Button>
          )}

          <Button variant="ghost" size="xs" asChild>
            <Link href={billDetailRoute(id)}>
              {t.rich('bill', { day, hidden: srOnly })}
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const SeriesOccurrences: FC<
  Record<'series', RecurringExpenseDetail> &
    Record<'onPay', (occurrence: Expense) => void>
> = ({ series, onPay }) => {
  const t = useTranslations('recurring.occurrences');
  const today = useReferenceDay();
  const headingId = useId();
  const viewInputName = useId();
  const [view, setView] = useState<OccurrenceView>('upcoming');
  const [page, setPage] = useState(FIRST_PAGE);

  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useExpenses({
    recurringExpenseId: series.id,
    sortBy: 'dueDate',
    page,
    pageSize: OCCURRENCES_PAGE_SIZE,
    ...occurrenceFiltersOf(view, today)
  });

  const isLoading = data === undefined && !isError;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold">
          {t('title')}
        </h3>

        <fieldset>
          <legend className="sr-only">{t('view')}</legend>

          <SegmentedControl>
            {OCCURRENCE_VIEWS.map((option) => (
              <SegmentedControlItem
                key={option}
                name={viewInputName}
                value={option}
                checked={option === view}
                onChange={() => {
                  setView(option);
                  setPage(FIRST_PAGE);
                }}
              >
                {t(`views.${option}`)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </fieldset>
      </div>

      <div aria-busy={isLoading || isPlaceholderData} className="space-y-3">
        {isLoading && <LoadingState label={t('loading')} className="h-40" />}

        {data === undefined && isError && (
          <ErrorState message={t('loadFailed')} onRetry={refetch} />
        )}

        {isRefetchError && (
          <StaleState isRetrying={isFetching} onRetry={refetch} />
        )}

        {data?.total === 0 && <EmptyState message={t(`empty.${view}`)} />}

        {data !== undefined && data.items.length > 0 && (
          <Table
            label={t('table', { view })}
            className={cn(
              'transition-opacity',
              isPlaceholderData && 'opacity-60'
            )}
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('columns.due')}</TableHead>

                <TableHead className="text-right">
                  {t('columns.amount')}
                </TableHead>

                <TableHead
                  className={cn('text-right', COLUMN_VISIBILITY.status)}
                >
                  {t('columns.status')}
                </TableHead>

                <TableHead className="text-right">
                  <span className="sr-only">{t('columns.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {data.items.map((occurrence) => (
                <OccurrenceRow
                  key={occurrence.id}
                  occurrence={occurrence}
                  today={today}
                  onPay={() => onPay(occurrence)}
                />
              ))}
            </TableBody>
          </Table>
        )}

        {data !== undefined && data.totalPages > 1 && (
          <div className="flex justify-end">
            <PageNavigation
              label={t('pages', { view })}
              page={data.page}
              totalPages={data.totalPages}
              detail={t('count', { count: data.total })}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </section>
  );
};

const SeriesDetails: FC<SeriesDetailsProps> = ({ series, onAction }) => {
  const t = useTranslations('recurring.details');
  const tFinances = useTranslations('finances');
  const tActions = useTranslations('common.actions');
  const today = useReferenceDay();
  const historyId = useId();
  const {
    description,
    status,
    currency,
    amount,
    isVariable,
    frequency,
    startDate,
    endDate,
    monthlyEquivalent,
    nextDueDate,
    category,
    subcategory,
    paymentMethod,
    account,
    notes,
    history
  } = series;

  const period = tFinances(`perPeriod.${frequency}`);
  const nextDistance =
    nextDueDate === null ? null : dueDistanceOf(nextDueDate, today, tFinances);

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="pr-6 wrap-anywhere">{description}</DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <SeriesStatusBadge status={status} />

            <span>
              {t('summary', {
                frequency: tFinances(`frequencies.${frequency}`),
                currency
              })}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Metric
          label={t(isVariable ? 'estimate' : 'amount', { period })}
          valueClassName={PROMINENT_VALUE_CLASS}
        >
          <Money value={amount} currency={currency} />
        </Metric>

        {frequency !== 'MONTHLY' && (
          <Metric label={t('monthly')} valueClassName={PROMINENT_VALUE_CLASS}>
            <Money value={monthlyEquivalent} currency={currency} />
          </Metric>
        )}

        <Metric label={t('nextBill')}>
          {nextDueDate === null ? (
            <UnavailableValue />
          ) : (
            <>
              <CalendarDayText day={nextDueDate} />

              {nextDistance !== null && (
                <span className="block text-sm font-normal text-muted-foreground">
                  {nextDistance}
                </span>
              )}
            </>
          )}
        </Metric>

        <Metric label={t('schedule')}>
          {endDate === null
            ? t.rich('scheduleOpen', {
                start: () => <CalendarDayText day={startDate} />
              })
            : t.rich('scheduleRange', {
                start: () => <CalendarDayText day={startDate} />,
                end: () => <CalendarDayText day={endDate} />
              })}
        </Metric>

        <Metric label={t('category')}>
          {tFinances(`categories.${category}`)}

          {subcategory !== null && (
            <span className="text-muted-foreground">
              {' · '}

              {subcategory}
            </span>
          )}
        </Metric>

        <Metric label={t('paymentMethod')}>
          {paymentMethod === null ? (
            <UnavailableValue />
          ) : (
            tFinances(`paymentMethods.${paymentMethod}`)
          )}
        </Metric>

        <Metric label={t('account')}>{account ?? <UnavailableValue />}</Metric>

        <Metric label={t('notes')} className="sm:col-span-2">
          {notes ?? <UnavailableValue />}
        </Metric>
      </dl>

      <SeriesOccurrences
        series={series}
        onPay={(occurrence) => onAction({ kind: 'pay', occurrence })}
      />

      <section aria-labelledby={historyId} className="space-y-3">
        <h3 id={historyId} className="text-sm font-semibold">
          {t('history')}
        </h3>

        <FinanceHistory events={history} currency={currency} />
      </section>

      <DialogFooter className="gap-2 sm:flex-wrap">
        <Button
          variant="destructive-subtle"
          className="sm:mr-auto"
          onClick={() => onAction({ kind: 'delete' })}
        >
          {tActions('delete')}
        </Button>

        {status === 'ACTIVE' && (
          <Button variant="outline" onClick={() => onAction({ kind: 'stop' })}>
            {t('stop')}
          </Button>
        )}

        <DialogClose asChild>
          <Button variant="secondary">{tActions('close')}</Button>
        </DialogClose>

        {status !== 'CANCELLED' && (
          <Button onClick={() => onAction({ kind: 'edit' })}>
            {tActions('edit')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
};

/**
 * Everything done to one recurring expense: its details, and the dialogs its
 * actions open. The details stay underneath each action, so cancelling one
 * returns to them.
 */
export const RecurringExpenseDialogs: FC<SeriesDialogsProps> = ({
  seriesId,
  onClose
}) => {
  const t = useTranslations('recurring');
  const [action, setAction] = useState<SeriesAction>({ kind: 'details' });
  const seriesQuery = useRecurringExpense(seriesId);

  const { mutateAsync: updateSeries } = useUpdateRecurringExpense();
  const { mutateAsync: stopSeries } = useCancelRecurringExpense();
  const { mutateAsync: deleteSeries } = useDeleteRecurringExpense();
  const { mutateAsync: recordPayment } = useRecordPayment();

  const series = seriesQuery.data;
  const backToDetails = () => setAction({ kind: 'details' });

  const close = () => {
    setAction({ kind: 'details' });
    onClose();
  };

  return (
    <>
      <Dialog
        open={seriesId !== null && action.kind === 'details'}
        onOpenChange={close}
      >
        <DialogContent className="sm:max-w-3xl">
          {series === undefined && seriesQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>{t('details.title')}</DialogTitle>

                <DialogDescription className="sr-only">
                  {t('details.loadFailed')}
                </DialogDescription>
              </DialogHeader>

              <ErrorState
                message={t('details.loadFailed')}
                onRetry={() => void seriesQuery.refetch()}
              />
            </>
          )}

          {series === undefined && !seriesQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>{t('details.title')}</DialogTitle>

                <DialogDescription className="sr-only">
                  {t('details.loading')}
                </DialogDescription>
              </DialogHeader>

              <LoadingState label={t('details.loading')} className="h-72" />
            </>
          )}

          {series !== undefined && (
            <SeriesDetails series={series} onAction={setAction} />
          )}
        </DialogContent>
      </Dialog>

      {series !== undefined && action.kind === 'edit' && (
        <EditSeriesDialog
          series={series}
          onCancel={backToDetails}
          onSubmit={async (changes) => {
            await updateSeries({ ...changes, id: series.id });
            backToDetails();
          }}
        />
      )}

      {series !== undefined && action.kind === 'stop' && (
        <StopSeriesDialog
          series={series}
          onCancel={backToDetails}
          onSubmit={async (terms) => {
            await stopSeries({ ...terms, id: series.id });
            backToDetails();
          }}
        />
      )}

      {series !== undefined && action.kind === 'pay' && (
        <PaymentFormDialog
          target={{ kind: 'record', expense: action.occurrence }}
          onCancel={backToDetails}
          onSubmit={async (payment) => {
            await recordPayment({
              ...payment,
              expenseId: action.occurrence.id
            });
            backToDetails();
          }}
        />
      )}

      {series !== undefined && action.kind === 'delete' && (
        <ConfirmDeletionDialog
          title={t('deletion.title')}
          description={t('deletion.description', {
            description: series.description
          })}
          confirmLabel={t('deletion.confirm')}
          failureMessage={t('deletion.failed')}
          onCancel={backToDetails}
          onConfirm={async () => {
            await deleteSeries({ id: series.id });
            close();
          }}
        />
      )}
    </>
  );
};
