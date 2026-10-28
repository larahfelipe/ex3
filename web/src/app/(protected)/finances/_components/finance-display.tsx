import type { FC } from 'react';

import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  FinanceEvent,
  InstallmentPlanStatus,
  PaymentMethod,
  RecurringExpenseStatus
} from '@/app/api/v1/finances';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_KIND_LABELS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_TONES,
  FINANCE_EVENT_LABELS,
  INSTALLMENT_PLAN_STATUS_LABELS,
  INSTALLMENT_PLAN_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
  RECURRING_EXPENSE_STATUS_LABELS,
  RECURRING_EXPENSE_STATUS_TONES
} from '@/common/constants';
import { formatMoney } from '@/common/utils';
import {
  daysBetween,
  formatCalendarDay,
  formatExecutionDay
} from '@/lib/dates';
import { isStorableDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

type ChangeEntry = Record<'from' | 'to', unknown>;

const CHANGED_FIELD_LABELS: Record<string, string> = {
  description: 'description',
  category: 'category',
  subcategory: 'subcategory',
  paymentMethod: 'payment method',
  account: 'account',
  notes: 'notes',
  amount: 'amount',
  dueDate: 'due date',
  effectiveFrom: 'effective from',
  entryDate: 'entry date',
  principalAmount: 'cash price',
  isVariable: 'variable amount',
  endDate: 'end date',
  discount: 'discount',
  fees: 'fees',
  paidOn: 'payment date',
  method: 'payment method'
};

type StatusBadgeProps<Status extends string> = Record<'status', Status> &
  Partial<Record<'className', string>>;

const StatusBadge: FC<
  Record<'tone' | 'label', string> & Partial<Record<'className', string>>
> = ({ tone, label, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      tone,
      className
    )}
  >
    {label}
  </span>
);

export const ExpenseStatusBadge: FC<StatusBadgeProps<ExpenseStatus>> = ({
  status,
  className
}) => (
  <StatusBadge
    tone={EXPENSE_STATUS_TONES[status]}
    label={EXPENSE_STATUS_LABELS[status]}
    className={className}
  />
);

export const PlanStatusBadge: FC<StatusBadgeProps<InstallmentPlanStatus>> = ({
  status,
  className
}) => (
  <StatusBadge
    tone={INSTALLMENT_PLAN_STATUS_TONES[status]}
    label={INSTALLMENT_PLAN_STATUS_LABELS[status]}
    className={className}
  />
);

export const SeriesStatusBadge: FC<
  StatusBadgeProps<RecurringExpenseStatus>
> = ({ status, className }) => (
  <StatusBadge
    tone={RECURRING_EXPENSE_STATUS_TONES[status]}
    label={RECURRING_EXPENSE_STATUS_LABELS[status]}
    className={className}
  />
);

export const InstallmentProgress: FC<
  Record<'paid' | 'count', number> & Partial<Record<'className', string>>
> = ({ paid, count, className }) => {
  const text = `${paid} of ${count} paid`;

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="progressbar"
        aria-label="Installments paid"
        aria-valuemin={0}
        aria-valuemax={count}
        aria-valuenow={paid}
        aria-valuetext={text}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${count === 0 ? 0 : (paid / count) * 100}%` }}
        />
      </div>

      <p aria-hidden="true" className="text-xs text-muted-foreground">
        {text}
      </p>
    </div>
  );
};

export const originLabelOf = ({
  kind,
  installmentNumber,
  installmentCount
}: Pick<Expense, 'kind' | 'installmentNumber' | 'installmentCount'>) =>
  kind === 'INSTALLMENT' &&
  installmentNumber !== null &&
  installmentCount !== null
    ? `Installment ${installmentNumber} of ${installmentCount}`
    : EXPENSE_KIND_LABELS[kind];

/** How far the due date is from `today`, for a bill still owed. */
export const dueDistanceOf = (dueDate: string, today: string) => {
  const days = daysBetween(today, dueDate);

  if (days === null) return null;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return '1 day overdue';

  return `${-days} days overdue`;
};

export const isOpenExpense = ({ status }: Pick<Expense, 'status'>) =>
  status === 'PENDING' || status === 'OVERDUE';

export const CalendarDayText: FC<Record<'day', string>> = ({ day }) => (
  <time dateTime={day}>{formatCalendarDay(day) ?? day}</time>
);

const MONEY_FIELDS = new Set([
  'amount',
  'principalAmount',
  'discount',
  'fees',
  'remainingAmount'
]);

const DAY_FIELDS = new Set([
  'effectiveFrom',
  'dueDate',
  'entryDate',
  'endDate',
  'paidOn',
  'nextDueDate'
]);

const PAYMENT_METHOD_FIELDS = new Set(['paymentMethod', 'method']);

const isPaymentMethod = (value: string): value is PaymentMethod =>
  Object.hasOwn(PAYMENT_METHOD_LABELS, value);

const isExpenseCategory = (value: string): value is ExpenseCategory =>
  Object.hasOwn(EXPENSE_CATEGORY_LABELS, value);

/** A value as the event recorded it: amounts and days as the API writes them. */
const recordedTextOf = (field: string, value: unknown, currency: string) => {
  if (value === null || value === undefined || value === '') return 'none';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value !== 'string') return String(value);
  if (MONEY_FIELDS.has(field) && isStorableDecimal(value))
    return formatMoney(value, currency);
  if (DAY_FIELDS.has(field)) return formatCalendarDay(value) ?? value;
  if (PAYMENT_METHOD_FIELDS.has(field) && isPaymentMethod(value))
    return PAYMENT_METHOD_LABELS[value];
  if (field === 'category' && isExpenseCategory(value))
    return EXPENSE_CATEGORY_LABELS[value];

  return value;
};

const isChangeEntry = (value: unknown): value is ChangeEntry =>
  typeof value === 'object' &&
  value !== null &&
  'from' in value &&
  'to' in value;

const fromDayOf = (changes: FinanceEvent['changes']) =>
  typeof changes.effectiveFrom === 'string'
    ? ` from ${recordedTextOf('effectiveFrom', changes.effectiveFrom, '')}`
    : '';

const countOf = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/** One line per event: what changed, from what to what, in the record's currency. */
export const describeEvent = (
  { type, changes }: Pick<FinanceEvent, 'type' | 'changes'>,
  currency: string
) => {
  const changedFields = Object.entries(changes).filter(([, change]) =>
    isChangeEntry(change)
  ) as Array<[string, ChangeEntry]>;

  if (changedFields.length > 0)
    return `${changedFields
      .map(
        ([field, { from, to }]) =>
          `${CHANGED_FIELD_LABELS[field] ?? field}: ${recordedTextOf(field, from, currency)} → ${recordedTextOf(field, to, currency)}`
      )
      .join('; ')}${fromDayOf(changes)}`;

  const {
    amount,
    paidOn,
    replaced,
    scheduled,
    removedOccurrences,
    cancelledOccurrences
  } = changes;

  if (type.startsWith('PAYMENT_') && typeof amount === 'string')
    return `${recordedTextOf('amount', amount, currency)}${typeof paidOn === 'string' ? ` paid on ${recordedTextOf('paidOn', paidOn, currency)}` : ''}`;

  if (type === 'RESCHEDULED' && Array.isArray(scheduled))
    return `${countOf(replaced)} open installments replaced by ${countOf(scheduled)}`;

  if (type === 'CANCELLED' && typeof changes.effectiveFrom === 'string')
    return `Stopped${fromDayOf(changes)}; ${countOf(removedOccurrences) + countOf(cancelledOccurrences)} unpaid occurrences dropped`;

  return null;
};

export const FinanceHistory: FC<
  Record<'events', ReadonlyArray<FinanceEvent>> & Record<'currency', string>
> = ({ events, currency }) =>
  events.length === 0 ? (
    <p className="text-sm text-muted-foreground">No changes recorded</p>
  ) : (
    <ol className="space-y-3 border-l pl-4">
      {events.map((event) => {
        const description = describeEvent(event, currency);

        return (
          <li key={event.id} className="relative space-y-0.5">
            <span
              aria-hidden="true"
              className="absolute top-1.5 -left-[1.3125rem] size-2 rounded-full bg-muted-foreground"
            />

            <p className="text-sm font-medium">
              {FINANCE_EVENT_LABELS[event.type]}

              <span className="font-normal text-muted-foreground">
                {' · '}

                <time dateTime={event.createdAt}>
                  {formatExecutionDay(event.createdAt)}
                </time>
              </span>
            </p>

            {description !== null && (
              <p className="text-sm text-muted-foreground wrap-anywhere">
                {description}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
