import { useId, useState, type FC } from 'react';

import Link from 'next/link';

import { Pencil, Trash2 } from 'lucide-react';
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
  DetailSection,
  FACT_LIST_CLASS,
  FACT_VALUE_CLASS,
  SUMMARY_DETAIL_CLASS,
  SUMMARY_PANEL_CLASS,
  SUMMARY_VALUE_CLASS
} from '@/components/detail-section';
import { Metric, Money, UnavailableValue } from '@/components/financial';
import { PageNavigation } from '@/components/page-navigation';
import {
  Button,
  Dialog,
  DialogActionFooter,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPresence,
  DialogTitle,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
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

import { CardLabel } from './credit-card-display';
import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  FinanceHistory,
  isOpenExpense,
  NextPayment,
  SeriesStatusBadge
} from './finance-display';
import { PaymentFormDialog } from './payment-form-dialog';
import { EditSeriesDialog, StopSeriesDialog } from './recurring-expense-forms';

type SeriesDialogsProps = Record<'seriesId', string> &
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
    <DetailSection
      title={t('title')}
      action={
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
      }
    >
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
    </DetailSection>
  );
};

const NextToPay: FC<
  Record<'series', RecurringExpenseDetail> &
    Record<'onPay', (occurrence: Expense) => void>
> = ({ series, onPay }) => {
  const t = useTranslations('recurring.details');
  const today = useReferenceDay();
  const { formatCalendarDay } = useFormat();
  const { data, isError } = useExpenses({
    recurringExpenseId: series.id,
    status: 'OPEN',
    sortBy: 'dueDate',
    sortOrder: 'asc',
    page: FIRST_PAGE,
    pageSize: 1
  });

  if (isError) return null;

  if (data === undefined)
    return (
      <div aria-hidden="true" className="border-t pt-4">
        <Skeleton className="h-12 w-full" />
      </div>
    );

  const [next] = data.items;

  if (next === undefined) return null;

  const day = formatCalendarDay(next.dueDate) ?? next.dueDate;

  return (
    <NextPayment
      expense={next}
      today={today}
      shownDueDate={series.nextDueDate}
      payLabel={t.rich('payNext', { day, hidden: srOnly })}
      onPay={() => onPay(next)}
    />
  );
};

const SeriesDetails: FC<SeriesDetailsProps> = ({ series, onAction }) => {
  const t = useTranslations('recurring.details');
  const tForm = useTranslations('recurring.form');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
  const today = useReferenceDay();
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
    creditCard,
    account,
    notes,
    history
  } = series;

  const period = tFinances(`perPeriod.${frequency}`);
  const nextDistance =
    nextDueDate === null ? null : dueDistanceOf(nextDueDate, today, tFinances);
  const payOccurrence = (occurrence: Expense) =>
    onAction({ kind: 'pay', occurrence });

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="wrap-anywhere">{description}</DialogTitle>

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

      <DialogBody className="gap-5">
        <div className={SUMMARY_PANEL_CLASS}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Metric
              label={t(isVariable ? 'estimate' : 'amount', { period })}
              valueClassName={SUMMARY_VALUE_CLASS}
            >
              <Money value={amount} currency={currency} />

              {frequency !== 'MONTHLY' && (
                <span className={SUMMARY_DETAIL_CLASS}>
                  {t('aboutMonthly', {
                    amount: formatMoney(monthlyEquivalent, currency)
                  })}
                </span>
              )}
            </Metric>

            <Metric label={t('nextBill')} valueClassName={SUMMARY_VALUE_CLASS}>
              {nextDueDate === null ? (
                <UnavailableValue />
              ) : (
                <>
                  <CalendarDayText day={nextDueDate} />

                  {nextDistance !== null && (
                    <span className={SUMMARY_DETAIL_CLASS}>{nextDistance}</span>
                  )}
                </>
              )}
            </Metric>
          </dl>

          <NextToPay series={series} onPay={payOccurrence} />
        </div>

        <SeriesOccurrences series={series} onPay={payOccurrence} />

        <DetailSection title={t('configuration')}>
          <dl className={FACT_LIST_CLASS}>
            <Metric label={t('frequency')} valueClassName={FACT_VALUE_CLASS}>
              {tFinances(`frequencies.${frequency}`)}
            </Metric>

            <Metric label={t('amountKind')} valueClassName={FACT_VALUE_CLASS}>
              {tForm(`amountKinds.${isVariable ? 'variable' : 'fixed'}`)}
            </Metric>

            <Metric
              label={t('schedule')}
              className="sm:col-span-2"
              valueClassName={FACT_VALUE_CLASS}
            >
              {endDate === null
                ? t.rich('scheduleOpen', {
                    start: () => <CalendarDayText day={startDate} />
                  })
                : t.rich('scheduleRange', {
                    start: () => <CalendarDayText day={startDate} />,
                    end: () => <CalendarDayText day={endDate} />
                  })}
            </Metric>

            <Metric label={t('category')} valueClassName={FACT_VALUE_CLASS}>
              {tFinances(`categories.${category}`)}

              {subcategory !== null && (
                <span className="text-muted-foreground">
                  {' · '}

                  {subcategory}
                </span>
              )}
            </Metric>

            <Metric
              label={t('paymentMethod')}
              valueClassName={FACT_VALUE_CLASS}
            >
              {paymentMethod === null ? (
                <UnavailableValue />
              ) : (
                tFinances(`paymentMethods.${paymentMethod}`)
              )}

              {creditCard !== null && (
                <CardLabel
                  card={creditCard}
                  className="mt-1 flex w-fit max-w-full"
                />
              )}
            </Metric>

            {account !== null && (
              <Metric label={t('account')} valueClassName={FACT_VALUE_CLASS}>
                {account}
              </Metric>
            )}

            {notes !== null && (
              <Metric
                label={t('notes')}
                className="sm:col-span-2"
                valueClassName="text-sm font-normal whitespace-pre-line"
              >
                {notes}
              </Metric>
            )}
          </dl>
        </DetailSection>

        <DetailSection title={t('history')}>
          <FinanceHistory events={history} currency={currency} />
        </DetailSection>
      </DialogBody>

      <DialogActionFooter
        tools={
          <>
            {status !== 'CANCELLED' && (
              <IconButton
                icon={Pencil}
                label={t('edit')}
                onClick={() => onAction({ kind: 'edit' })}
              />
            )}

            <IconButton
              icon={Trash2}
              variant="ghost-destructive"
              label={t('delete')}
              onClick={() => onAction({ kind: 'delete' })}
            />
          </>
        }
      >
        {status === 'ACTIVE' && (
          <Button variant="outline" onClick={() => onAction({ kind: 'stop' })}>
            {t('stop')}
          </Button>
        )}
      </DialogActionFooter>
    </>
  );
};

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

  return (
    <>
      <Dialog open={action.kind === 'details'} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl">
          {series === undefined && seriesQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>{t('details.title')}</DialogTitle>

                <DialogDescription className="sr-only">
                  {t('details.loadFailed')}
                </DialogDescription>
              </DialogHeader>

              <DialogBody>
                <ErrorState
                  message={t('details.loadFailed')}
                  onRetry={() => void seriesQuery.refetch()}
                />
              </DialogBody>
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

              <DialogBody>
                <LoadingState label={t('details.loading')} className="h-72" />
              </DialogBody>
            </>
          )}

          {series !== undefined && (
            <SeriesDetails series={series} onAction={setAction} />
          )}
        </DialogContent>
      </Dialog>

      <DialogPresence>
        {series !== undefined && action.kind === 'edit' && (
          <EditSeriesDialog
            key="edit"
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
            key="stop"
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
            key="pay"
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
            key="delete"
            title={t('deletion.title')}
            description={t('deletion.description', {
              description: series.description
            })}
            confirmLabel={t('deletion.confirm')}
            failureMessage={t('deletion.failed')}
            onCancel={backToDetails}
            onConfirm={async () => {
              await deleteSeries({ id: series.id });
              onClose();
            }}
          />
        )}
      </DialogPresence>
    </>
  );
};
