import { useState, type FC } from 'react';

import Link from 'next/link';

import type { Expense, InstallmentPlanDetail } from '@/app/api/v1/finances';
import {
  billDetailRoute,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  RECURRENCE_FREQUENCY_LABELS
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
import { isNonzeroDecimal, isStorableDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  FinanceHistory,
  InstallmentProgress,
  isOpenExpense,
  PlanStatusBadge
} from './finance-display';
import { EditPlanDialog, ReschedulePlanDialog } from './installment-plan-forms';
import { PaymentFormDialog } from './payment-form-dialog';

type PlanDialogsProps = Record<'planId', string | null> &
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

/** What the installments cost over the cash price; a negative one costs less. */
const FinancingCost: FC<Record<'cost' | 'currency', string>> = ({
  cost,
  currency
}) => {
  const isBelow = cost.startsWith('-');
  const magnitude = isBelow ? cost.slice(1) : cost;

  if (!isStorableDecimal(magnitude)) return cost;
  if (!isNonzeroDecimal(magnitude)) return 'None';
  if (!isBelow) return <Money value={magnitude} currency={currency} />;

  return `${formatMoney(magnitude, currency)} below the cash price`;
};

const InstallmentRow: FC<
  Record<'installment', Expense> &
    Record<'today', string> &
    Record<'onPay', VoidFunction>
> = ({ installment, today, onPay }) => {
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
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today) : null;
  const name = `installment ${installmentNumber}`;

  return (
    <TableRow>
      <TableRowHeader className="py-2.5">
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-medium whitespace-nowrap">
            {`${installmentNumber} of ${installmentCount}`}
          </span>

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
              <span className="sr-only">{` ${name}`}</span>
            </Button>
          )}

          <Button variant="ghost" size="xs" asChild>
            <Link href={billDetailRoute(id)}>
              Bill
              <span className="sr-only">{` of ${name}`}</span>
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const PlanDetails: FC<PlanDetailsProps> = ({ plan, onAction }) => {
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
    nextDueDate === null ? null : dueDistanceOf(nextDueDate, today);

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="pr-6 wrap-anywhere">{description}</DialogTitle>

        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <PlanStatusBadge status={status} />

            <span>{`${installmentCount} ${RECURRENCE_FREQUENCY_LABELS[frequency].toLowerCase()} ${installmentCount === 1 ? 'installment' : 'installments'} in ${currency}`}</span>
          </div>
        </DialogDescription>
      </DialogHeader>

      <InstallmentProgress paid={paidInstallments} count={installmentCount} />

      <dl className="grid gap-4 sm:grid-cols-3">
        <Metric label="Total" valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={totalAmount} currency={currency} />
        </Metric>

        <Metric label="Outstanding" valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={outstandingAmount} currency={currency} />
        </Metric>

        <Metric label="Settled" valueClassName={PROMINENT_VALUE_CLASS}>
          <Money value={settledAmount} currency={currency} />
        </Metric>

        <Metric label="Next installment">
          {nextDueDate === null || nextInstallmentNumber === null ? (
            <UnavailableValue />
          ) : (
            <>
              {`${nextInstallmentNumber} of ${installmentCount}, `}

              <CalendarDayText day={nextDueDate} />

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

        <Metric label="Cash price">
          {principalAmount === null ? (
            <UnavailableValue />
          ) : (
            <Money value={principalAmount} currency={currency} />
          )}
        </Metric>

        <Metric label="Over the cash price">
          {financingCost === null ? (
            <UnavailableValue />
          ) : (
            <FinancingCost cost={financingCost} currency={currency} />
          )}
        </Metric>

        <Metric label="Schedule">
          {firstDueDate === null || lastDueDate === null ? (
            <UnavailableValue />
          ) : (
            <>
              <CalendarDayText day={firstDueDate} />

              {' to '}

              <CalendarDayText day={lastDueDate} />
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

      <section aria-labelledby="plan-installments" className="space-y-1">
        <h3 id="plan-installments" className="text-sm font-semibold">
          Installments
        </h3>

        <Table label="Installments table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Installment</TableHead>

              <TableHead className={COLUMN_VISIBILITY.due}>Due</TableHead>

              <TableHead className="text-right">Amount</TableHead>

              <TableHead className={cn('text-right', COLUMN_VISIBILITY.status)}>
                Status
              </TableHead>

              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
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
          History
        </h3>

        <FinanceHistory events={history} currency={currency} />
      </section>

      <DialogFooter className="gap-2 sm:flex-wrap">
        {!isNonzeroDecimal(settledAmount) && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive sm:mr-auto"
            onClick={() => onAction({ kind: 'delete' })}
          >
            Delete
          </Button>
        )}

        {isActive && (
          <Button
            variant="outline"
            onClick={() => onAction({ kind: 'cancel' })}
          >
            Cancel plan
          </Button>
        )}

        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>

        {status !== 'CANCELLED' && (
          <Button variant="outline" onClick={() => onAction({ kind: 'edit' })}>
            Edit
          </Button>
        )}

        {isActive && (
          <Button onClick={() => onAction({ kind: 'reschedule' })}>
            Reschedule
          </Button>
        )}
      </DialogFooter>
    </>
  );
};

/**
 * Everything done to one plan: its details, and the dialogs its actions open.
 * The details stay underneath each action, so cancelling one returns to them.
 */
export const InstallmentPlanDialogs: FC<PlanDialogsProps> = ({
  planId,
  onClose
}) => {
  const [action, setAction] = useState<PlanAction>({ kind: 'details' });
  const planQuery = useInstallmentPlan(planId);

  const { mutateAsync: updatePlan } = useUpdateInstallmentPlan();
  const { mutateAsync: reschedulePlan } = useRescheduleInstallmentPlan();
  const { mutateAsync: cancelPlan } = useCancelInstallmentPlan();
  const { mutateAsync: deletePlan } = useDeleteInstallmentPlan();
  const { mutateAsync: recordPayment } = useRecordPayment();

  const plan = planQuery.data;
  const backToDetails = () => setAction({ kind: 'details' });

  const close = () => {
    setAction({ kind: 'details' });
    onClose();
  };

  return (
    <>
      <Dialog
        open={planId !== null && action.kind === 'details'}
        onOpenChange={close}
      >
        <DialogContent className="sm:max-w-3xl">
          {plan === undefined && planQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>Installment plan</DialogTitle>

                <DialogDescription className="sr-only">
                  The plan could not be loaded
                </DialogDescription>
              </DialogHeader>

              <ErrorState
                message="This plan could not be loaded"
                onRetry={() => void planQuery.refetch()}
              />
            </>
          )}

          {plan === undefined && !planQuery.isError && (
            <>
              <DialogHeader>
                <DialogTitle>Installment plan</DialogTitle>

                <DialogDescription className="sr-only">
                  Loading the plan
                </DialogDescription>
              </DialogHeader>

              <LoadingState label="Loading the plan" className="h-72" />
            </>
          )}

          {plan !== undefined && (
            <PlanDetails plan={plan} onAction={setAction} />
          )}
        </DialogContent>
      </Dialog>

      {plan !== undefined && action.kind === 'edit' && (
        <EditPlanDialog
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
          title="Cancel this plan?"
          description={`${plan.description}. The installments with no payment are cancelled and stop counting as owed; a partly paid one stays owed. The plan and its history are kept, and this cannot be undone.`}
          confirmLabel="Cancel plan"
          failureMessage="The plan could not be cancelled"
          onCancel={backToDetails}
          onConfirm={async () => {
            await cancelPlan({ id: plan.id });
            backToDetails();
          }}
        />
      )}

      {plan !== undefined && action.kind === 'delete' && (
        <ConfirmDeletionDialog
          title="Delete this plan?"
          description={`${plan.description}. The plan and its ${plan.installments.length} installments are removed with their history, and this cannot be undone. Cancel it instead to keep a record.`}
          confirmLabel="Delete plan"
          failureMessage="The plan could not be deleted"
          onCancel={backToDetails}
          onConfirm={async () => {
            await deletePlan({ id: plan.id });
            close();
          }}
        />
      )}
    </>
  );
};
