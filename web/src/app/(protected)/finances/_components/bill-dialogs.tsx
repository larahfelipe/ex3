import { useState, type FC } from 'react';

import Link from 'next/link';

import { useTranslations } from 'use-intl';

import type { ExpenseDetail, ExpensePayment } from '@/app/api/v1/finances';
import {
  installmentPlanRoute,
  recurringExpenseRoute
} from '@/common/constants';
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
import { useFormat } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import { apiErrorMessageOf } from '@/lib/api-error-message';
import { isNonzeroDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

import { expenseChangesOf, ExpenseFormDialog } from './expense-form-dialog';
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
  const t = useTranslations('bills.payment');
  const tFinances = useTranslations('finances');
  const { formatCalendarDay, formatMoney } = useFormat();
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
          {t.rich('paidOn', {
            money: () => <Money value={amount} currency={currency} />,
            day: () => <CalendarDayText day={paidOn} />,
            muted: (chunks) => (
              <span className="font-normal text-muted-foreground">
                {chunks}
              </span>
            )
          })}
        </p>

        <p className="text-sm text-muted-foreground wrap-anywhere">
          {[
            isVoided ? t('voided') : null,
            method === null ? null : tFinances(`paymentMethods.${method}`),
            isNonzeroDecimal(discount)
              ? t('discount', { amount: formatMoney(discount, currency) })
              : null,
            isNonzeroDecimal(fees)
              ? t('fees', { amount: formatMoney(fees, currency) })
              : null,
            notes
          ]
            .filter((detail) => detail !== null)
            .join(' · ') || t('noDetails')}
        </p>
      </div>

      {canChange && !isVoided && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onAction({ kind: 'correct', payment })}
          >
            {t.rich('correct', { day: shownDay, hidden: srOnly })}
          </Button>

          <Button
            variant="destructive-subtle"
            size="xs"

            onClick={() => onAction({ kind: 'void', payment })}
          >
            {t.rich('void', { day: shownDay, hidden: srOnly })}
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
  const t = useTranslations('bills.details');
  const tFinances = useTranslations('finances');
  const tActions = useTranslations('common.actions');
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
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today, tFinances) : null;
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

            <span>{originLabelOf(expense, tFinances)}</span>

            {originRoute !== null && (
              <Link
                href={originRoute}
                className="text-primary underline-offset-4 hover:underline"
              >
                {kind === 'INSTALLMENT' ? t('viewPlan') : t('viewSeries')}
              </Link>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Metric label={t('amount')} valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={amount} currency={currency} />
        </Metric>

        <Metric label={t('outstanding')} valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={outstandingAmount} currency={currency} />
        </Metric>

        <Metric label={t('settled')} valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={settledAmount} currency={currency} />
        </Metric>

        <Metric label={t('dueDate')}>
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

        <Metric label={t('paidInFullOn')}>
          {settledOn === null ? (
            <UnavailableValue />
          ) : (
            <CalendarDayText day={settledOn} />
          )}
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

        <Metric label={t('notes')} className="sm:col-span-3">
          {notes ?? <UnavailableValue />}
        </Metric>
      </dl>

      <section aria-labelledby="bill-payments" className="space-y-1">
        <h3 id="bill-payments" className="text-sm font-semibold">
          {t('payments')}
        </h3>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
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
          {t('history')}
        </h3>

        <FinanceHistory events={history} currency={currency} />
      </section>

      <DialogFooter className="gap-2 sm:flex-wrap">
        {kind === 'ONE_TIME' && !hasActivePayments && (
          <Button
            variant="destructive-subtle"
            className="sm:mr-auto"
            onClick={() => onAction({ kind: 'delete' })}
          >
            {tActions('delete')}
          </Button>
        )}

        {!isCancelled && !hasActivePayments && (
          <Button
            variant="outline"
            onClick={() => onAction({ kind: 'cancel' })}
          >
            {t('cancel')}
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
            {t('restore')}
          </Button>
        )}

        <DialogClose asChild>
          <Button variant="secondary">{tActions('close')}</Button>
        </DialogClose>

        {!isCancelled && (
          <Button variant="outline" onClick={() => onAction({ kind: 'edit' })}>
            {tActions('edit')}
          </Button>
        )}

        {isOpen && (
          <Button onClick={() => onAction({ kind: 'pay' })}>
            {t('recordPayment')}
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
  const t = useTranslations('bills');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const { formatCalendarDay, formatMoney } = useFormat();
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
        apiErrorMessageOf(error, tErrors, t('details.restoreFailed'))
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
                <DialogTitle>{t('details.title')}</DialogTitle>

                <DialogDescription className="sr-only">
                  {t('details.loadFailed')}
                </DialogDescription>
              </DialogHeader>

              <ErrorState
                message={t('details.loadFailed')}
                onRetry={() => void expenseQuery.refetch()}
              />
            </>
          )}

          {expense === undefined && !expenseQuery.isError && (
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
          title={t('voiding.title')}
          description={t('voiding.description', {
            amount: formatMoney(action.payment.amount, expense.currency),
            day:
              formatCalendarDay(action.payment.paidOn) ?? action.payment.paidOn
          })}
          confirmLabel={t('voiding.confirm')}
          failureMessage={t('voiding.failed')}
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
          title={t('cancellation.title')}
          description={t('cancellation.description', {
            description: expense.description,
            day: formatCalendarDay(expense.dueDate) ?? expense.dueDate
          })}
          confirmLabel={t('cancellation.confirm')}
          cancelLabel={tActions('back')}
          failureMessage={t('cancellation.failed')}
          onCancel={backToDetails}
          onConfirm={async () => {
            await updateExpense({ id: expense.id, cancelled: true });
            backToDetails();
          }}
        />
      )}

      {expense !== undefined && action.kind === 'delete' && (
        <ConfirmDeletionDialog
          title={t('deletion.title')}
          description={t('deletion.description', {
            description: expense.description,
            day: formatCalendarDay(expense.dueDate) ?? expense.dueDate
          })}
          confirmLabel={t('deletion.confirm')}
          failureMessage={t('deletion.failed')}
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
