import { useState, type FC } from 'react';

import Link from 'next/link';

import { Pencil, Trash2, Undo2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  Expense,
  ExpenseDetail,
  ExpensePayment
} from '@/app/api/v1/finances';
import {
  installmentPlanRoute,
  recurringExpenseRoute
} from '@/common/constants';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { ErrorState, LoadingState } from '@/components/data-state';
import {
  DetailSection,
  FACT_LIST_CLASS,
  FACT_VALUE_CLASS,
  SUMMARY_DETAIL_CLASS,
  SUMMARY_PANEL_CLASS,
  SUMMARY_VALUE_CLASS
} from '@/components/detail-section';
import { Metric, Money, UnavailableValue } from '@/components/financial';
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
  IconButton
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
import { apiErrorMessageOf } from '@/lib/api-error-message';
import { isNonzeroDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

import { CardLabel } from './credit-card-display';
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

type BillDialogsProps = Record<'expenseId', string> &
  Record<'onClose', VoidFunction>;

type BillAction =
  | Record<'kind', 'details' | 'edit' | 'pay' | 'cancel' | 'delete'>
  | (Record<'kind', 'correct' | 'void'> & Record<'payment', ExpensePayment>);

type BillDetailsProps = Record<'expense', ExpenseDetail> &
  Record<'onAction', (action: BillAction) => void> &
  Record<'onRestore', () => Promise<unknown>> &
  Record<'isRestoring', boolean> &
  Record<'restoreError', string | null>;

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
    <li className="flex items-start justify-between gap-3 py-2.5">
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
        <div className="-my-1 -mr-2 flex shrink-0 sm:-my-0.5 sm:-mr-1.5">
          <IconButton
            icon={Pencil}
            label={t('correct')}
            aria-label={t('correctNamed', { day: shownDay })}
            onClick={() => onAction({ kind: 'correct', payment })}
          />

          <IconButton
            icon={Undo2}
            variant="ghost-destructive"
            label={t('void')}
            aria-label={t('voidNamed', { day: shownDay })}
            onClick={() => onAction({ kind: 'void', payment })}
          />
        </div>
      )}
    </li>
  );
};

export const BillSummary: FC<Record<'expense', Expense>> = ({ expense }) => {
  const t = useTranslations('bills.details');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
  const today = useReferenceDay();
  const {
    status,
    amount,
    currency,
    outstandingAmount,
    settledAmount,
    dueDate,
    originalDueDate,
    settledOn,
    category,
    subcategory,
    paymentMethod,
    creditCard
  } = expense;

  const isOpen = isOpenExpense(expense);
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today, tFinances) : null;
  const isPartlySettled = isOpen && isNonzeroDecimal(settledAmount);

  return (
    <dl className={cn(SUMMARY_PANEL_CLASS, 'sm:grid-cols-2')}>
      <Metric label={t('amount')} valueClassName={SUMMARY_VALUE_CLASS}>
        <Money value={amount} currency={currency} />

        {isPartlySettled && (
          <span className={SUMMARY_DETAIL_CLASS}>
            {t('partlySettled', {
              outstanding: formatMoney(outstandingAmount, currency),
              settled: formatMoney(settledAmount, currency)
            })}
          </span>
        )}

        {settledOn !== null && (
          <span className={SUMMARY_DETAIL_CLASS}>
            {t.rich('settledOn', {
              day: () => <CalendarDayText day={settledOn} />
            })}
          </span>
        )}
      </Metric>

      <Metric
        label={creditCard === null ? t('dueDate') : t('cardDueDate')}
        valueClassName={SUMMARY_VALUE_CLASS}
      >
        <CalendarDayText day={dueDate} />

        {dueDistance !== null && (
          <span
            className={cn(
              SUMMARY_DETAIL_CLASS,
              status === 'OVERDUE' && 'text-negative'
            )}
          >
            {dueDistance}
          </span>
        )}

        {originalDueDate !== null && (
          <span className={SUMMARY_DETAIL_CLASS}>
            {t.rich('ownDueDate', {
              day: () => <CalendarDayText day={originalDueDate} />
            })}
          </span>
        )}
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

      <Metric label={t('paymentMethod')} valueClassName={FACT_VALUE_CLASS}>
        {paymentMethod === null ? (
          <UnavailableValue />
        ) : (
          tFinances(`paymentMethods.${paymentMethod}`)
        )}

        {creditCard !== null && (
          <CardLabel card={creditCard} className="mt-1 flex w-fit max-w-full" />
        )}
      </Metric>
    </dl>
  );
};

export const BillFacts: FC<Record<'expense', Expense>> = ({ expense }) => {
  const t = useTranslations('bills.details');
  const { account, notes } = expense;

  return account === null && notes === null ? null : (
    <DetailSection title={t('facts')}>
      <dl className={FACT_LIST_CLASS}>
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
  );
};

const BillDetails: FC<BillDetailsProps> = ({
  expense,
  onAction,
  onRestore,
  isRestoring,
  restoreError
}) => {
  const t = useTranslations('bills.details');
  const tFinances = useTranslations('finances');
  const {
    description,
    status,
    kind,
    currency,
    payments,
    history,
    installmentPlanId,
    recurringExpenseId
  } = expense;

  const isCancelled = status === 'CANCELLED';
  const isOpen = isOpenExpense(expense);
  const hasActivePayments = payments.some(isActivePayment);
  const canDelete = kind === 'ONE_TIME' && !hasActivePayments;
  const originRoute =
    installmentPlanId !== null
      ? installmentPlanRoute(installmentPlanId)
      : recurringExpenseId !== null
        ? recurringExpenseRoute(recurringExpenseId)
        : null;

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="wrap-anywhere">{description}</DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ExpenseStatusBadge status={status} />

            <span>{originLabelOf(expense, tFinances)}</span>

            {originRoute !== null && (
              <Link
                href={originRoute}
                className="rounded-xs text-primary underline-offset-4 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-focus"
              >
                {kind === 'INSTALLMENT' ? t('viewPlan') : t('viewSeries')}
              </Link>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="gap-5">
        <BillSummary expense={expense} />

        <DetailSection
          title={
            <>
              {t('payments')}

              {payments.length > 0 && (
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  {payments.length}
                </span>
              )}
            </>
          }
        >
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noPayments')}</p>
          ) : (
            <ul className="-mt-1 divide-y">
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
        </DetailSection>

        <BillFacts expense={expense} />

        <DetailSection title={t('history')}>
          <FinanceHistory events={history} currency={currency} />
        </DetailSection>
      </DialogBody>

      {restoreError !== null && (
        <p role="alert" className="shrink-0 px-5 pb-4 text-sm text-negative">
          {restoreError}
        </p>
      )}

      <DialogActionFooter
        tools={
          (!isCancelled || canDelete) && (
            <>
              {!isCancelled && (
                <IconButton
                  icon={Pencil}
                  label={t('edit')}
                  onClick={() => onAction({ kind: 'edit' })}
                />
              )}

              {canDelete && (
                <IconButton
                  icon={Trash2}
                  variant="ghost-destructive"
                  label={t('delete')}
                  onClick={() => onAction({ kind: 'delete' })}
                />
              )}
            </>
          )
        }
      >
        {(isCancelled || isOpen || !hasActivePayments) && (
          <>
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

            {isOpen && (
              <Button onClick={() => onAction({ kind: 'pay' })}>
                {t('recordPayment')}
              </Button>
            )}
          </>
        )}
      </DialogActionFooter>
    </>
  );
};

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
      <Dialog open={action.kind === 'details'} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          {expense === undefined && expenseQuery.isError && (
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
                  onRetry={() => void expenseQuery.refetch()}
                />
              </DialogBody>
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

              <DialogBody>
                <LoadingState label={t('details.loading')} className="h-72" />
              </DialogBody>
            </>
          )}

          {expense !== undefined && (
            <BillDetails
              expense={expense}
              isRestoring={isUpdating}
              restoreError={restoreError}
              onRestore={restore}
              onAction={(nextAction) => {
                setRestoreError(null);
                setAction(nextAction);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <DialogPresence>
        {expense !== undefined && action.kind === 'edit' && (
          <ExpenseFormDialog
            key="edit"
            target={{ kind: 'edit', expense }}
            onCancel={backToDetails}
            onSubmit={async (draft) => {
              await updateExpense({
                ...expenseChangesOf(draft, expense),
                id: expense.id
              });
              backToDetails();
            }}
          />
        )}

        {expense !== undefined && action.kind === 'pay' && (
          <PaymentFormDialog
            key="pay"
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
            key="correct"
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
            key="void"
            title={t('voiding.title')}
            description={t('voiding.description', {
              amount: formatMoney(action.payment.amount, expense.currency),
              day:
                formatCalendarDay(action.payment.paidOn) ??
                action.payment.paidOn
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
            key="cancel"
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
            key="delete"
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
              onClose();
            }}
          />
        )}
      </DialogPresence>
    </>
  );
};
