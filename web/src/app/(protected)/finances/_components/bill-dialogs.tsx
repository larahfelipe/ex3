import { useState, type FC } from 'react';

import Link from 'next/link';

import type { ExpenseDetail, ExpensePayment } from '@/app/api/v1/finances';
import {
  EXPENSE_CATEGORY_LABELS,
  installmentPlanRoute,
  PAYMENT_METHOD_LABELS,
  recurringExpenseRoute
} from '@/common/constants';
import { formatMoney } from '@/common/utils';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { ErrorState, LoadingState } from '@/components/data-state';
import {
  Metric,
  Money,
  PROMINENT_VALUE_CLASS,
  UnavailableValue
} from '@/components/financial';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui';
import {
  useDeleteExpense,
  useExpense,
  useRecordPayment,
  useReferenceDay,
  useUpdateExpense,
  useUpdatePayment,
  useVoidPayment
} from '@/hooks/use-finances';
import { formatCalendarDay } from '@/lib/dates';
import { isNonzeroDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

import { ExpenseFormDialog, expenseChangesOf } from './expense-form-dialog';
import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  FinanceHistory,
  isOpenExpense,
  originLabelOf
} from './finance-display';
import { PaymentFormDialog } from './payment-form-dialog';

type BillDialogsProps = Record<'expenseId', string | null> &
  Record<'onClose', VoidFunction>;

type BillAction =
  | Record<'kind', 'details' | 'edit' | 'pay' | 'cancel' | 'delete'>
  | (Record<'kind', 'correct' | 'void'> & Record<'payment', ExpensePayment>);

type BillDetailsProps = Record<'expense', ExpenseDetail> &
  Record<'onAction', (action: BillAction) => void> &
  Record<'onRestore', () => Promise<unknown>> &
  Record<'isRestoring', boolean>;

const isActivePayment = ({ voidedAt }: Pick<ExpensePayment, 'voidedAt'>) =>
  voidedAt === null;

const PaymentRow: FC<
  Record<'payment', ExpensePayment> &
    Record<'currency', string> &
    Record<'canChange', boolean> &
    Record<'onAction', BillDetailsProps['onAction']>
> = ({ payment, currency, canChange, onAction }) => {
  const { amount, discount, fees, paidOn, method, notes, voidedAt } = payment;
  const isVoided = voidedAt !== null;
  const shownDay = formatCalendarDay(paidOn) ?? paidOn;

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 space-y-0.5">
        <p
          className={cn(
            'text-sm font-medium',
            isVoided && 'text-muted-foreground line-through'
          )}
        >
          <Money value={amount} currency={currency} />

          <span className="font-normal text-muted-foreground">
            {' on '}

            <CalendarDayText day={paidOn} />
          </span>
        </p>

        <p className="text-sm text-muted-foreground wrap-anywhere">
          {[
            isVoided ? 'Voided' : null,
            method === null ? null : PAYMENT_METHOD_LABELS[method],
            isNonzeroDecimal(discount)
              ? `${formatMoney(discount, currency)} discount`
              : null,
            isNonzeroDecimal(fees)
              ? `${formatMoney(fees, currency)} interest and fees`
              : null,
            notes
          ]
            .filter((detail) => detail !== null)
            .join(' · ') || 'No details'}
        </p>
      </div>

      {canChange && !isVoided && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onAction({ kind: 'correct', payment })}
          >
            Correct
            <span className="sr-only">{` the payment on ${shownDay}`}</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            className="text-destructive hover:text-destructive"
            onClick={() => onAction({ kind: 'void', payment })}
          >
            Void
            <span className="sr-only">{` the payment on ${shownDay}`}</span>
          </Button>
        </div>
      )}
    </li>
  );
};

const BillDetails: FC<BillDetailsProps> = ({
  expense,
  onAction,
  onRestore,
  isRestoring
}) => {
  const today = useReferenceDay();
  const {
    description,
    status,
    kind,
    amount,
    currency,
    outstandingAmount,
    settledAmount,
    dueDate,
    settledOn,
    category,
    subcategory,
    paymentMethod,
    account,
    notes,
    payments,
    history,
    installmentPlanId,
    recurringExpenseId
  } = expense;

  const isCancelled = status === 'CANCELLED';
  const isOpen = isOpenExpense(expense);
  const hasActivePayments = payments.some(isActivePayment);
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today) : null;
  const originRoute =
    installmentPlanId !== null
      ? installmentPlanRoute(installmentPlanId)
      : recurringExpenseId !== null
        ? recurringExpenseRoute(recurringExpenseId)
        : null;

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="pr-6 wrap-anywhere">{description}</DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <ExpenseStatusBadge status={status} />

            <span>{originLabelOf(expense)}</span>

            {originRoute !== null && (
              <Link
                href={originRoute}
                className="text-primary underline-offset-4 hover:underline"
              >
                {kind === 'INSTALLMENT' ? 'View plan' : 'View series'}
              </Link>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Metric label="Amount" valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={amount} currency={currency} />
        </Metric>

        <Metric label="Outstanding" valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={outstandingAmount} currency={currency} />
        </Metric>

        <Metric label="Settled" valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={settledAmount} currency={currency} />
        </Metric>

        <Metric label="Due date">
          <CalendarDayText day={dueDate} />

          {dueDistance !== null && (
            <span
              className={cn(
                'block text-sm font-normal',
                status === 'OVERDUE' ? 'text-negative' : 'text-muted-foreground'
              )}
            >
              {dueDistance}
            </span>
          )}
        </Metric>

        <Metric label="Paid in full on">
          {settledOn === null ? (
            <UnavailableValue />
          ) : (
            <CalendarDayText day={settledOn} />
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

        <Metric label="Notes" className="sm:col-span-3">
          {notes ?? <UnavailableValue />}
        </Metric>
      </dl>

      <section aria-labelledby="bill-payments" className="space-y-1">
        <h3 id="bill-payments" className="text-sm font-semibold">
          Payments
        </h3>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payment recorded yet
          </p>
        ) : (
          <ul className="divide-y">
            {payments.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                currency={currency}
                canChange={!isCancelled}
                onAction={onAction}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bill-history" className="space-y-3">
        <h3 id="bill-history" className="text-sm font-semibold">
          History
        </h3>

        <FinanceHistory events={history} currency={currency} />
      </section>

      <DialogFooter className="gap-2 sm:flex-wrap">
        {kind === 'ONE_TIME' && !hasActivePayments && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive sm:mr-auto"
            onClick={() => onAction({ kind: 'delete' })}
          >
            Delete
          </Button>
        )}

        {!isCancelled && !hasActivePayments && (
          <Button
            variant="outline"
            onClick={() => onAction({ kind: 'cancel' })}
          >
            Cancel bill
          </Button>
        )}

        {isCancelled && (
          <Button
            variant="outline"
            aria-disabled={isRestoring}
            onClick={() => {
              if (!isRestoring) void onRestore();
            }}
          >
            Restore bill
          </Button>
        )}

        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>

        {!isCancelled && (
          <Button variant="outline" onClick={() => onAction({ kind: 'edit' })}>
            Edit
          </Button>
        )}

        {isOpen && (
          <Button onClick={() => onAction({ kind: 'pay' })}>
            Record payment
          </Button>
        )}
      </DialogFooter>
    </>
  );
};

/**
 * Everything done to one bill: its details, and the dialogs its actions open.
 * The details stay underneath each action, so cancelling one returns to them.
 */
export const BillDialogs: FC<BillDialogsProps> = ({ expenseId, onClose }) => {
  const [action, setAction] = useState<BillAction>({ kind: 'details' });
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const expenseQuery = useExpense(expenseId);

  const { mutateAsync: updateExpense, isPending: isUpdating } =
    useUpdateExpense();
  const { mutateAsync: deleteExpense } = useDeleteExpense();
  const { mutateAsync: recordPayment } = useRecordPayment();
  const { mutateAsync: updatePayment } = useUpdatePayment();
  const { mutateAsync: voidPayment } = useVoidPayment();

  const expense = expenseQuery.data;
  const backToDetails = () => setAction({ kind: 'details' });

  const close = () => {
    setAction({ kind: 'details' });
    setRestoreError(null);
    onClose();
  };

  const restore = async () => {
    if (expense === undefined) return;

    setRestoreError(null);

    try {
      await updateExpense({ id: expense.id, cancelled: false });
    } catch (error) {
      setRestoreError(
        error instanceof Error
          ? error.message
          : 'The bill could not be restored'
      );
    }
  };

  return (
    <>
      <Dialog
        open={expenseId !== null && action.kind === 'details'}
        onOpenChange={close}
      >
        <DialogContent className="sm:max-w-2xl">
          {expense === undefined && expenseQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>Bill</DialogTitle>

                <DialogDescription className="sr-only">
                  The bill could not be loaded
                </DialogDescription>
              </DialogHeader>

              <ErrorState
                message="This bill could not be loaded"
                onRetry={() => void expenseQuery.refetch()}
              />
            </>
          )}

          {expense === undefined && !expenseQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>Bill</DialogTitle>

                <DialogDescription className="sr-only">
                  Loading the bill
                </DialogDescription>
              </DialogHeader>

              <LoadingState label="Loading the bill" className="h-72" />
            </>
          )}

          {expense !== undefined && (
            <>
              <BillDetails
                expense={expense}
                isRestoring={isUpdating}
                onRestore={restore}
                onAction={(nextAction) => {
                  setRestoreError(null);
                  setAction(nextAction);
                }}
              />

              {restoreError !== null && (
                <p role="alert" className="text-sm text-negative">
                  {restoreError}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {expense !== undefined && action.kind === 'edit' && (
        <ExpenseFormDialog
          target={{ kind: 'edit', expense }}
          onCancel={backToDetails}
          onSubmit={async (draft) => {
            await updateExpense({ ...expenseChangesOf(draft), id: expense.id });
            backToDetails();
          }}
        />
      )}

      {expense !== undefined && action.kind === 'pay' && (
        <PaymentFormDialog
          target={{ kind: 'record', expense }}
          onCancel={backToDetails}
          onSubmit={async (payment) => {
            await recordPayment({ ...payment, expenseId: expense.id });
            backToDetails();
          }}
        />
      )}

      {expense !== undefined && action.kind === 'correct' && (
        <PaymentFormDialog
          target={{ kind: 'correct', expense, payment: action.payment }}
          onCancel={backToDetails}
          onSubmit={async (payment) => {
            await updatePayment({
              ...payment,
              expenseId: expense.id,
              paymentId: action.payment.id
            });
            backToDetails();
          }}
        />
      )}

      {expense !== undefined && action.kind === 'void' && (
        <ConfirmDeletionDialog
          title="Void this payment?"
          description={`${formatMoney(action.payment.amount, expense.currency)} paid on ${formatCalendarDay(action.payment.paidOn) ?? action.payment.paidOn}. It stays in the history as voided, and the bill owes what it settled again.`}
          confirmLabel="Void payment"
          failureMessage="The payment could not be voided"
          onCancel={backToDetails}
          onConfirm={async () => {
            await voidPayment({
              expenseId: expense.id,
              paymentId: action.payment.id
            });
            backToDetails();
          }}
        />
      )}

      {expense !== undefined && action.kind === 'cancel' && (
        <ConfirmDeletionDialog
          title="Cancel this bill?"
          description={`${expense.description}, due ${formatCalendarDay(expense.dueDate) ?? expense.dueDate}. It stops counting as owed and stays in the history; you can restore it later.`}
          confirmLabel="Cancel bill"
          failureMessage="The bill could not be cancelled"
          onCancel={backToDetails}
          onConfirm={async () => {
            await updateExpense({ id: expense.id, cancelled: true });
            backToDetails();
          }}
        />
      )}

      {expense !== undefined && action.kind === 'delete' && (
        <ConfirmDeletionDialog
          title="Delete this bill?"
          description={`${expense.description}, due ${formatCalendarDay(expense.dueDate) ?? expense.dueDate}. It is removed with its history, and this cannot be undone. Cancel it instead to keep a record.`}
          confirmLabel="Delete bill"
          failureMessage="The bill could not be deleted"
          onCancel={backToDetails}
          onConfirm={async () => {
            await deleteExpense({ id: expense.id });
            close();
          }}
        />
      )}
    </>
  );
};
