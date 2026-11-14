import { useState, type FC } from 'react';

import Link from 'next/link';

import { useTranslations } from 'use-intl';

import type { Expense, InstallmentPlanDetail } from '@/app/api/v1/finances';
import { billDetailRoute } from '@/common/constants';
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
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPresence,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import {
  useCancelInstallmentPlan,
  useDeleteInstallmentPlan,
  useInstallmentPlan,
  useRecordPayment,
  useReferenceDay,
  useRescheduleInstallmentPlan,
  useUpdateInstallmentPlan
} from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import { isNonzeroDecimal, isStorableDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  FinanceHistory,
  InstallmentProgress,
  isOpenExpense,
  originLabelOf,
  PlanStatusBadge
} from './finance-display';
import { EditPlanDialog, ReschedulePlanDialog } from './installment-plan-forms';
import { PaymentFormDialog } from './payment-form-dialog';

type PlanDialogsProps = Record<'planId', string> &
  Record<'onClose', VoidFunction>;

type PlanAction =
  | Record<'kind', 'details' | 'edit' | 'reschedule' | 'cancel' | 'delete'>
  | (Record<'kind', 'pay'> & Record<'installment', Expense>);

type PlanDetailsProps = Record<'plan', InstallmentPlanDetail> &
  Record<'onAction', (action: PlanAction) => void>;

const COLUMN_VISIBILITY = {
  due: 'max-sm:hidden',
  status: 'max-md:hidden'
} as const;

const FinancingCost: FC<Record<'cost' | 'currency', string>> = ({
  cost,
  currency
}) => {
  const t = useTranslations('installments.details');
  const { formatMoney } = useFormat();
  const isBelow = cost.startsWith('-');
  const magnitude = isBelow ? cost.slice(1) : cost;

  if (!isStorableDecimal(magnitude)) return cost;
  if (!isNonzeroDecimal(magnitude)) return t('financingNone');
  if (!isBelow) return <Money value={magnitude} currency={currency} />;

  return t('financingBelow', { amount: formatMoney(magnitude, currency) });
};

const InstallmentRow: FC<
  Record<'installment', Expense> &
    Record<'today', string> &
    Record<'onPay', VoidFunction>
> = ({ installment, today, onPay }) => {
  const t = useTranslations('installments.installment');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
  const {
    id,
    installmentNumber,
    installmentCount,
    dueDate,
    amount,
    outstandingAmount,
    settledAmount,
    currency,
    status
  } = installment;
  const isOpen = isOpenExpense(installment);
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today, tFinances) : null;
  const position =
    installmentNumber === null || installmentCount === null
      ? originLabelOf(installment, tFinances)
      : t('position', { number: installmentNumber, count: installmentCount });

  return (
    <TableRow>
      <TableRowHeader className="py-2.5">
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-medium whitespace-nowrap">{position}</span>

          <span className="text-xs text-muted-foreground sm:hidden">
            <CalendarDayText day={dueDate} />
          </span>

          <ExpenseStatusBadge status={status} className="md:hidden" />
        </div>
      </TableRowHeader>

      <TableCell className={cn('whitespace-nowrap', COLUMN_VISIBILITY.due)}>
        <div className="flex flex-col gap-0.5">
          <CalendarDayText day={dueDate} />

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
        </div>
      </TableCell>

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
              {t.rich('pay', { position, hidden: srOnly })}
            </Button>
          )}

          <Button variant="ghost" size="xs" asChild>
            <Link href={billDetailRoute(id)}>
              {t.rich('bill', { position, hidden: srOnly })}
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const PlanDetails: FC<PlanDetailsProps> = ({ plan, onAction }) => {
  const t = useTranslations('installments.details');
  const tFinances = useTranslations('finances');
  const tActions = useTranslations('common.actions');
  const today = useReferenceDay();
  const {
    description,
    status,
    currency,
    frequency,
    totalAmount,
    settledAmount,
    outstandingAmount,
    principalAmount,
    financingCost,
    installmentCount,
    paidInstallments,
    nextDueDate,
    nextInstallmentNumber,
    firstDueDate,
    lastDueDate,
    category,
    subcategory,
    paymentMethod,
    account,
    notes,
    installments,
    history
  } = plan;

  const isActive = status === 'ACTIVE';
  const nextDistance =
    nextDueDate === null ? null : dueDistanceOf(nextDueDate, today, tFinances);

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="wrap-anywhere">{description}</DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <PlanStatusBadge status={status} />

            <span>
              {t('summary', { count: installmentCount, frequency, currency })}
            </span>
          </div>
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        <InstallmentProgress paid={paidInstallments} count={installmentCount} />

        <dl className="grid gap-4 sm:grid-cols-3">
          <Metric label={t('total')} valueClassName={PROMINENT_VALUE_CLASS}>
            <Money value={totalAmount} currency={currency} />
          </Metric>

          <Metric
            label={t('outstanding')}
            valueClassName={PROMINENT_VALUE_CLASS}
          >
            <Money value={outstandingAmount} currency={currency} />
          </Metric>

          <Metric label={t('settled')} valueClassName={PROMINENT_VALUE_CLASS}>
            <Money value={settledAmount} currency={currency} />
          </Metric>

          <Metric label={t('nextInstallment')}>
            {nextDueDate === null || nextInstallmentNumber === null ? (
              <UnavailableValue />
            ) : (
              <>
                {t.rich('next', {
                  number: nextInstallmentNumber,
                  count: installmentCount,
                  day: () => <CalendarDayText day={nextDueDate} />
                })}

                {nextDistance !== null && (
                  <span
                    className={cn(
                      'block text-sm font-normal',
                      nextDueDate < today
                        ? 'text-negative'
                        : 'text-muted-foreground'
                    )}
                  >
                    {nextDistance}
                  </span>
                )}
              </>
            )}
          </Metric>

          <Metric label={t('cashPrice')}>
            {principalAmount === null ? (
              <UnavailableValue />
            ) : (
              <Money value={principalAmount} currency={currency} />
            )}
          </Metric>

          <Metric label={t('overCashPrice')}>
            {financingCost === null ? (
              <UnavailableValue />
            ) : (
              <FinancingCost cost={financingCost} currency={currency} />
            )}
          </Metric>

          <Metric label={t('schedule')}>
            {firstDueDate === null || lastDueDate === null ? (
              <UnavailableValue />
            ) : (
              t.rich('scheduleRange', {
                first: () => <CalendarDayText day={firstDueDate} />,
                last: () => <CalendarDayText day={lastDueDate} />
              })
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

          <Metric label={t('account')}>
            {account ?? <UnavailableValue />}
          </Metric>

          <Metric label={t('notes')} className="sm:col-span-2">
            {notes ?? <UnavailableValue />}
          </Metric>
        </dl>

        <section aria-labelledby="plan-installments" className="space-y-1">
          <h3 id="plan-installments" className="text-sm font-semibold">
            {t('installments')}
          </h3>

          <Table label={t('table')}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('columns.installment')}</TableHead>

                <TableHead className={COLUMN_VISIBILITY.due}>
                  {t('columns.due')}
                </TableHead>

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
              {installments.map((installment) => (
                <InstallmentRow
                  key={installment.id}
                  installment={installment}
                  today={today}
                  onPay={() => onAction({ kind: 'pay', installment })}
                />
              ))}
            </TableBody>
          </Table>
        </section>

        <section aria-labelledby="plan-history" className="space-y-3">
          <h3 id="plan-history" className="text-sm font-semibold">
            {t('history')}
          </h3>

          <FinanceHistory events={history} currency={currency} />
        </section>
      </DialogBody>

      <DialogFooter className="gap-2 sm:flex-wrap">
        {!isNonzeroDecimal(settledAmount) && (
          <Button
            variant="destructive-subtle"
            className="sm:mr-auto"
            onClick={() => onAction({ kind: 'delete' })}
          >
            {tActions('delete')}
          </Button>
        )}

        {isActive && (
          <Button
            variant="outline"
            onClick={() => onAction({ kind: 'cancel' })}
          >
            {t('cancel')}
          </Button>
        )}

        <DialogClose asChild>
          <Button variant="secondary">{tActions('close')}</Button>
        </DialogClose>

        {status !== 'CANCELLED' && (
          <Button variant="outline" onClick={() => onAction({ kind: 'edit' })}>
            {tActions('edit')}
          </Button>
        )}

        {isActive && (
          <Button onClick={() => onAction({ kind: 'reschedule' })}>
            {t('reschedule')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
};

export const InstallmentPlanDialogs: FC<PlanDialogsProps> = ({
  planId,
  onClose
}) => {
  const t = useTranslations('installments');
  const tActions = useTranslations('common.actions');
  const [action, setAction] = useState<PlanAction>({ kind: 'details' });
  const planQuery = useInstallmentPlan(planId);

  const { mutateAsync: updatePlan } = useUpdateInstallmentPlan();
  const { mutateAsync: reschedulePlan } = useRescheduleInstallmentPlan();
  const { mutateAsync: cancelPlan } = useCancelInstallmentPlan();
  const { mutateAsync: deletePlan } = useDeleteInstallmentPlan();
  const { mutateAsync: recordPayment } = useRecordPayment();

  const plan = planQuery.data;
  const backToDetails = () => setAction({ kind: 'details' });

  return (
    <>
      <Dialog open={action.kind === 'details'} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl">
          {plan === undefined && planQuery.isError && (
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
                  onRetry={() => void planQuery.refetch()}
                />
              </DialogBody>
            </>
          )}

          {plan === undefined && !planQuery.isError && (
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

          {plan !== undefined && (
            <PlanDetails plan={plan} onAction={setAction} />
          )}
        </DialogContent>
      </Dialog>

      <DialogPresence>
        {plan !== undefined && action.kind === 'edit' && (
          <EditPlanDialog
            key="edit"
            plan={plan}
            onCancel={backToDetails}
            onSubmit={async (changes) => {
              await updatePlan({ ...changes, id: plan.id });
              backToDetails();
            }}
          />
        )}

        {plan !== undefined && action.kind === 'reschedule' && (
          <ReschedulePlanDialog
            key="reschedule"
            plan={plan}
            onCancel={backToDetails}
            onSubmit={async (terms) => {
              await reschedulePlan({ ...terms, id: plan.id });
              backToDetails();
            }}
          />
        )}

        {plan !== undefined && action.kind === 'pay' && (
          <PaymentFormDialog
            key="pay"
            target={{ kind: 'record', expense: action.installment }}
            onCancel={backToDetails}
            onSubmit={async (payment) => {
              await recordPayment({
                ...payment,
                expenseId: action.installment.id
              });
              backToDetails();
            }}
          />
        )}

        {plan !== undefined && action.kind === 'cancel' && (
          <ConfirmDeletionDialog
            key="cancel"
            title={t('cancellation.title')}
            description={t('cancellation.description', {
              description: plan.description
            })}
            confirmLabel={t('cancellation.confirm')}
            cancelLabel={tActions('back')}
            failureMessage={t('cancellation.failed')}
            onCancel={backToDetails}
            onConfirm={async () => {
              await cancelPlan({ id: plan.id });
              backToDetails();
            }}
          />
        )}

        {plan !== undefined && action.kind === 'delete' && (
          <ConfirmDeletionDialog
            key="delete"
            title={t('deletion.title')}
            description={t('deletion.description', {
              description: plan.description,
              count: plan.installments.length
            })}
            confirmLabel={t('deletion.confirm')}
            failureMessage={t('deletion.failed')}
            onCancel={backToDetails}
            onConfirm={async () => {
              await deletePlan({ id: plan.id });
              onClose();
            }}
          />
        )}
      </DialogPresence>
    </>
  );
};
