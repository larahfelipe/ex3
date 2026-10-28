import { useId, useState, type FC } from 'react';

import Link from 'next/link';

import type { Expense, RecurringExpenseDetail } from '@/app/api/v1/finances';
import {
  billDetailRoute,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_FREQUENCY_UNITS
} from '@/common/constants';
import { formatMoney } from '@/common/utils';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  STALE_DATA_MESSAGE,
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
import { formatCalendarDay, shiftCalendarDay } from '@/lib/dates';
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

const OCCURRENCE_VIEW_LABELS: Record<OccurrenceView, string> = {
  upcoming: 'Upcoming',
  earlier: 'Earlier'
};

const OCCURRENCE_VIEW_EMPTY_MESSAGES: Record<OccurrenceView, string> = {
  upcoming: 'No upcoming bills',
  earlier: 'No earlier bills'
};

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
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today) : null;
  const dueText = formatCalendarDay(dueDate) ?? dueDate;

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
              Edited on its own
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
              {`${formatMoney(outstandingAmount, currency)} left`}
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
              Pay
              <span className="sr-only">{` the bill due ${dueText}`}</span>
            </Button>
          )}

          <Button variant="ghost" size="xs" asChild>
            <Link href={billDetailRoute(id)}>
              Bill
              <span className="sr-only">{` due ${dueText}`}</span>
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
          Bills
        </h3>

        <fieldset>
          <legend className="sr-only">Show bills</legend>

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
                {OCCURRENCE_VIEW_LABELS[option]}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </fieldset>
      </div>

      <div aria-busy={isLoading || isPlaceholderData} className="space-y-3">
        {isLoading && (
          <LoadingState label="Loading the bills" className="h-40" />
        )}

        {data === undefined && isError && (
          <ErrorState
            message="The bills could not be loaded"
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
          <EmptyState message={OCCURRENCE_VIEW_EMPTY_MESSAGES[view]} />
        )}

        {data !== undefined && data.items.length > 0 && (
          <Table
            label={`${OCCURRENCE_VIEW_LABELS[view]} bills`}
            className={cn(
              'transition-opacity',
              isPlaceholderData && 'opacity-60'
            )}
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Due</TableHead>

                <TableHead className="text-right">Amount</TableHead>

                <TableHead
                  className={cn('text-right', COLUMN_VISIBILITY.status)}
                >
                  Status
                </TableHead>

                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
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
              label={`${OCCURRENCE_VIEW_LABELS[view]} bill pages`}
              page={data.page}
              totalPages={data.totalPages}
              detail={`${data.total} ${data.total === 1 ? 'bill' : 'bills'}`}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </section>
  );
};

const SeriesDetails: FC<SeriesDetailsProps> = ({ series, onAction }) => {
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

  const unit = RECURRENCE_FREQUENCY_UNITS[frequency];
  const nextDistance =
    nextDueDate === null ? null : dueDistanceOf(nextDueDate, today);

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="pr-6 wrap-anywhere">{description}</DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <SeriesStatusBadge status={status} />

            <span>{`${RECURRENCE_FREQUENCY_LABELS[frequency]} in ${currency}`}</span>
          </div>
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Metric
          label={isVariable ? `Estimate per ${unit}` : `Amount per ${unit}`}
          valueClassName={PROMINENT_VALUE_CLASS}
        >
          <Money value={amount} currency={currency} />
        </Metric>

        {frequency !== 'MONTHLY' && (
          <Metric label="About a month" valueClassName={PROMINENT_VALUE_CLASS}>
            <Money value={monthlyEquivalent} currency={currency} />
          </Metric>
        )}

        <Metric label="Next bill">
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

        <Metric label="Schedule">
          {'From '}

          <CalendarDayText day={startDate} />

          {endDate === null ? (
            ', no end date'
          ) : (
            <>
              {' to '}

              <CalendarDayText day={endDate} />
            </>
          )}
        </Metric>

        <Metric label="Category">
          {EXPENSE_CATEGORY_LABELS[category]}

          {subcategory !== null && (
            <span className="text-muted-foreground">{` · ${subcategory}`}</span>
          )}
        </Metric>

        <Metric label="Payment method">
          {paymentMethod === null ? (
            <UnavailableValue />
          ) : (
            PAYMENT_METHOD_LABELS[paymentMethod]
          )}
        </Metric>

        <Metric label="Account or card">
          {account ?? <UnavailableValue />}
        </Metric>

        <Metric label="Notes" className="sm:col-span-2">
          {notes ?? <UnavailableValue />}
        </Metric>
      </dl>

      <SeriesOccurrences
        series={series}
        onPay={(occurrence) => onAction({ kind: 'pay', occurrence })}
      />

      <section aria-labelledby={historyId} className="space-y-3">
        <h3 id={historyId} className="text-sm font-semibold">
          History
        </h3>

        <FinanceHistory events={history} currency={currency} />
      </section>

      <DialogFooter className="gap-2 sm:flex-wrap">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive sm:mr-auto"
          onClick={() => onAction({ kind: 'delete' })}
        >
          Delete
        </Button>

        {status === 'ACTIVE' && (
          <Button variant="outline" onClick={() => onAction({ kind: 'stop' })}>
            Stop series
          </Button>
        )}

        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>

        {status !== 'CANCELLED' && (
          <Button onClick={() => onAction({ kind: 'edit' })}>Edit</Button>
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
                <DialogTitle>Recurring expense</DialogTitle>

                <DialogDescription className="sr-only">
                  The recurring expense could not be loaded
                </DialogDescription>
              </DialogHeader>

              <ErrorState
                message="This recurring expense could not be loaded"
                onRetry={() => void seriesQuery.refetch()}
              />
            </>
          )}

          {series === undefined && !seriesQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>Recurring expense</DialogTitle>

                <DialogDescription className="sr-only">
                  Loading the recurring expense
                </DialogDescription>
              </DialogHeader>

              <LoadingState
                label="Loading the recurring expense"
                className="h-72"
              />
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
          title="Delete this recurring expense?"
          description={`${series.description}. The series and its bills are removed with their history, and this cannot be undone. A series with payments cannot be deleted: stop it instead to keep a record.`}
          confirmLabel="Delete series"
          failureMessage="The recurring expense could not be deleted"
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
