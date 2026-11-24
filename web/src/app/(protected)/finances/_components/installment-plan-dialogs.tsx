import { useState, type FC } from 'react';

import Link from 'next/link';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { Expense, InstallmentPlanDetail } from '@/app/api/v1/finances';
import { billDetailRoute } from '@/common/constants';
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
  IconButton,
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
import type { Translator } from '@/i18n/translator';
import { isNonzeroDecimal, isStorableDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

import { CardLabel } from './credit-card-display';
import {
  CalendarDayText,
  dueDistanceOf,
  ExpenseStatusBadge,
  FinanceHistory,
  InstallmentProgress,
  isOpenExpense,
  NextPayment,
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

const positionOf = (
  installment: Expense,
  t: Translator<'installments.installment'>,
  tFinances: Translator<'finances'>
) =>
  installment.installmentNumber === null ||
  installment.installmentCount === null
    ? originLabelOf(installment, tFinances)
    : t('position', {
        number: installment.installmentNumber,
        count: installment.installmentCount
      });

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
    dueDate,
    amount,
    outstandingAmount,
    settledAmount,
    currency,
    status
  } = installment;
  const isOpen = isOpenExpense(installment);
  const dueDistance = isOpen ? dueDistanceOf(dueDate, today, tFinances) : null;
  const position = positionOf(installment, t, tFinances);

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
  const tInstallment = useTranslations('installments.installment');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
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
    creditCard,
    account,
    notes,
    installments,
    history
  } = plan;

  const isActive = status === 'ACTIVE';
  const nextOpen = installments.find(isOpenExpense);
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

      <DialogBody className="gap-5">
        <div className={SUMMARY_PANEL_CLASS}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Metric
              label={t('outstanding')}
              valueClassName={SUMMARY_VALUE_CLASS}
            >
              <Money value={outstandingAmount} currency={currency} />

              <span className={SUMMARY_DETAIL_CLASS}>
                {t('settledOfTotal', {
                  settled: formatMoney(settledAmount, currency),
                  total: formatMoney(totalAmount, currency)
                })}
              </span>
            </Metric>

            <Metric
              label={t('nextInstallment')}
              valueClassName={SUMMARY_VALUE_CLASS}
            >
              {nextDueDate === null || nextInstallmentNumber === null ? (
                <UnavailableValue />
              ) : (
                <>
                  <CalendarDayText day={nextDueDate} />

                  <span className={SUMMARY_DETAIL_CLASS}>
                    {tFinances('display.installmentOf', {
                      number: nextInstallmentNumber,
                      count: installmentCount
                    })}

                    {nextDistance !== null && (
                      <span
                        className={cn(nextDueDate < today && 'text-negative')}
                      >
                        {' · '}

                        {nextDistance}
                      </span>
                    )}
                  </span>
                </>
              )}
            </Metric>
          </dl>

          <InstallmentProgress
            paid={paidInstallments}
            count={installmentCount}
            className="border-t pt-4"
          />

          {nextOpen !== undefined && (
            <NextPayment
              expense={nextOpen}
              today={today}
              shownDueDate={nextDueDate}
              payLabel={tInstallment.rich('pay', {
                position: positionOf(nextOpen, tInstallment, tFinances),
                hidden: srOnly
              })}
              onPay={() => onAction({ kind: 'pay', installment: nextOpen })}
            />
          )}
        </div>

        <DetailSection title={t('installments')}>
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
        </DetailSection>

        <DetailSection title={t('facts')}>
          <dl className={FACT_LIST_CLASS}>
            <Metric label={t('total')} valueClassName={FACT_VALUE_CLASS}>
              <Money value={totalAmount} currency={currency} />
            </Metric>

            <Metric label={t('schedule')} valueClassName={FACT_VALUE_CLASS}>
              {firstDueDate === null || lastDueDate === null ? (
                <UnavailableValue />
              ) : (
                t.rich('scheduleRange', {
                  first: () => <CalendarDayText day={firstDueDate} />,
                  last: () => <CalendarDayText day={lastDueDate} />
                })
              )}
            </Metric>

            <Metric label={t('cashPrice')} valueClassName={FACT_VALUE_CLASS}>
              {principalAmount === null ? (
                <UnavailableValue />
              ) : (
                <Money value={principalAmount} currency={currency} />
              )}
            </Metric>

            <Metric
              label={t('overCashPrice')}
              valueClassName={FACT_VALUE_CLASS}
            >
              {financingCost === null ? (
                <UnavailableValue />
              ) : (
                <FinancingCost cost={financingCost} currency={currency} />
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
          (status !== 'CANCELLED' || !isNonzeroDecimal(settledAmount)) && (
            <>
              {status !== 'CANCELLED' && (
                <IconButton
                  icon={Pencil}
                  label={t('edit')}
                  onClick={() => onAction({ kind: 'edit' })}
                />
              )}

              {!isNonzeroDecimal(settledAmount) && (
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
        {isActive && (
          <>
            <Button
              variant="outline"
              onClick={() => onAction({ kind: 'cancel' })}
            >
              {t('cancel')}
            </Button>

            <Button onClick={() => onAction({ kind: 'reschedule' })}>
              {t('reschedule')}
            </Button>
          </>
        )}
      </DialogActionFooter>
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
