import type { FC } from 'react';

import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleStop,
  Clock,
  type LucideIcon
} from 'lucide-react';
import { useTranslations } from 'use-intl';

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
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS_TONES,
  INSTALLMENT_PLAN_STATUS_TONES,
  PAYMENT_METHODS,
  RECURRING_EXPENSE_STATUS_TONES
} from '@/common/constants';
import { type Format, useFormat } from '@/i18n/format';
import type { Translator } from '@/i18n/translator';
import { daysBetween } from '@/lib/dates';
import { isStorableDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

type ChangeEntry = Record<'from' | 'to', unknown>;

type FinancesTranslator = Translator<'finances'>;

const CHANGED_FIELDS = [
  'description',
  'category',
  'subcategory',
  'paymentMethod',
  'account',
  'notes',
  'amount',
  'dueDate',
  'effectiveFrom',
  'entryDate',
  'principalAmount',
  'isVariable',
  'endDate',
  'discount',
  'fees',
  'paidOn',
  'method'
] as const;

type ChangedField = (typeof CHANGED_FIELDS)[number];

type StatusBadgeProps<Status extends string> = Record<'status', Status> &
  Partial<Record<'className', string>>;

const EXPENSE_STATUS_ICONS: Record<ExpenseStatus, LucideIcon> = {
  PENDING: Clock,
  OVERDUE: CircleAlert,
  PAID: CircleCheck,
  CANCELLED: Ban
};

const PLAN_STATUS_ICONS: Record<InstallmentPlanStatus, LucideIcon> = {
  ACTIVE: CircleDot,
  COMPLETED: CircleCheck,
  CANCELLED: Ban
};

const SERIES_STATUS_ICONS: Record<RecurringExpenseStatus, LucideIcon> = {
  ACTIVE: CircleDot,
  ENDED: CircleCheck,
  CANCELLED: CircleStop
};

/** Each status has its own icon besides its tone, so statuses differ in shape as well as in color. */
const StatusBadge: FC<
  Record<'tone' | 'label', string> &
    Record<'icon', LucideIcon> &
    Partial<Record<'className', string>>
> = ({ tone, label, icon: Icon, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border py-0.5 pr-2 pl-1.5 text-xs font-medium whitespace-nowrap',
      tone,
      className
    )}
  >
    <Icon aria-hidden className="size-3 shrink-0" />

    {label}
  </span>
);

export const ExpenseStatusBadge: FC<StatusBadgeProps<ExpenseStatus>> = ({
  status,
  className
}) => {
  const t = useTranslations('finances.statuses');

  return (
    <StatusBadge
      tone={EXPENSE_STATUS_TONES[status]}
      label={t(status)}
      icon={EXPENSE_STATUS_ICONS[status]}
      className={className}
    />
  );
};

export const PlanStatusBadge: FC<StatusBadgeProps<InstallmentPlanStatus>> = ({
  status,
  className
}) => {
  const t = useTranslations('finances.planStatuses');

  return (
    <StatusBadge
      tone={INSTALLMENT_PLAN_STATUS_TONES[status]}
      label={t(status)}
      icon={PLAN_STATUS_ICONS[status]}
      className={className}
    />
  );
};

export const SeriesStatusBadge: FC<
  StatusBadgeProps<RecurringExpenseStatus>
> = ({ status, className }) => {
  const t = useTranslations('finances.seriesStatuses');

  return (
    <StatusBadge
      tone={RECURRING_EXPENSE_STATUS_TONES[status]}
      label={t(status)}
      icon={SERIES_STATUS_ICONS[status]}
      className={className}
    />
  );
};

export const InstallmentProgress: FC<
  Record<'paid' | 'count', number> & Partial<Record<'className', string>>
> = ({ paid, count, className }) => {
  const t = useTranslations('finances.display');
  const text = t('progress', { paid, count });

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="progressbar"
        aria-label={t('installmentsPaid')}
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

export const originLabelOf = (
  {
    kind,
    installmentNumber,
    installmentCount
  }: Pick<Expense, 'kind' | 'installmentNumber' | 'installmentCount'>,
  t: FinancesTranslator
) =>
  kind === 'INSTALLMENT' &&
  installmentNumber !== null &&
  installmentCount !== null
    ? t('display.installmentOf', {
        number: installmentNumber,
        count: installmentCount
      })
    : t(`kinds.${kind}`);

/** How far the due date is from `today`, for a bill still owed. */
export const dueDistanceOf = (
  dueDate: string,
  today: string,
  t: FinancesTranslator
) => {
  const days = daysBetween(today, dueDate);

  if (days === null) return null;

  return days >= 0
    ? t('display.dueIn', { days })
    : t('display.overdueBy', { days: -days });
};

export const isOpenExpense = ({ status }: Pick<Expense, 'status'>) =>
  status === 'PENDING' || status === 'OVERDUE';

export const CalendarDayText: FC<Record<'day', string>> = ({ day }) => {
  const { formatCalendarDay } = useFormat();

  return <time dateTime={day}>{formatCalendarDay(day) ?? day}</time>;
};

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
  PAYMENT_METHODS.some((method) => method === value);

const isExpenseCategory = (value: string): value is ExpenseCategory =>
  EXPENSE_CATEGORIES.some((category) => category === value);

const isChangedField = (field: string): field is ChangedField =>
  CHANGED_FIELDS.some((known) => known === field);

/** A value as the event recorded it: amounts and days as the API writes them. */
const recordedTextOf = (
  field: string,
  value: unknown,
  currency: string,
  t: FinancesTranslator,
  { formatCalendarDay, formatMoney }: Format
) => {
  if (value === null || value === undefined || value === '')
    return t('history.none');
  if (typeof value === 'boolean')
    return value ? t('history.yes') : t('history.no');
  if (typeof value !== 'string') return String(value);
  if (MONEY_FIELDS.has(field) && isStorableDecimal(value))
    return formatMoney(value, currency);
  if (DAY_FIELDS.has(field)) return formatCalendarDay(value) ?? value;
  if (PAYMENT_METHOD_FIELDS.has(field) && isPaymentMethod(value))
    return t(`paymentMethods.${value}`);
  if (field === 'category' && isExpenseCategory(value))
    return t(`categories.${value}`);

  return value;
};

const isChangeEntry = (value: unknown): value is ChangeEntry =>
  typeof value === 'object' &&
  value !== null &&
  'from' in value &&
  'to' in value;

const countOf = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/** One line per event: what changed, from what to what, in the record's currency. */
export const describeEvent = (
  { type, changes }: Pick<FinanceEvent, 'type' | 'changes'>,
  currency: string,
  t: FinancesTranslator,
  format: Format
) => {
  const recordedText = (field: string, value: unknown) =>
    recordedTextOf(field, value, currency, t, format);
  const fromDay =
    typeof changes.effectiveFrom === 'string'
      ? recordedText('effectiveFrom', changes.effectiveFrom)
      : null;
  const changedFields = Object.entries(changes).filter(([, change]) =>
    isChangeEntry(change)
  ) as Array<[string, ChangeEntry]>;

  if (changedFields.length > 0) {
    const changesText = changedFields
      .map(([field, { from, to }]) =>
        t('history.change', {
          field: isChangedField(field) ? t(`changedFields.${field}`) : field,
          from: recordedText(field, from),
          to: recordedText(field, to)
        })
      )
      .join('; ');

    return fromDay === null
      ? changesText
      : t('history.changesFrom', { changes: changesText, day: fromDay });
  }

  const {
    amount,
    paidOn,
    replaced,
    scheduled,
    removedOccurrences,
    cancelledOccurrences
  } = changes;

  if (type.startsWith('PAYMENT_') && typeof amount === 'string')
    return typeof paidOn === 'string'
      ? t('history.paidOn', {
          amount: recordedText('amount', amount),
          day: recordedText('paidOn', paidOn)
        })
      : t('history.paid', { amount: recordedText('amount', amount) });

  if (type === 'RESCHEDULED' && Array.isArray(scheduled))
    return t('history.rescheduled', {
      replaced: countOf(replaced),
      scheduled: countOf(scheduled)
    });

  if (type === 'CANCELLED' && fromDay !== null)
    return t('history.stopped', {
      day: fromDay,
      dropped: countOf(removedOccurrences) + countOf(cancelledOccurrences)
    });

  return null;
};

export const FinanceHistory: FC<
  Record<'events', ReadonlyArray<FinanceEvent>> & Record<'currency', string>
> = ({ events, currency }) => {
  const t = useTranslations('finances');
  const format = useFormat();

  return events.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
  ) : (
    <ol className="space-y-3 border-l pl-4">
      {events.map((event) => {
        const description = describeEvent(event, currency, t, format);

        return (
          <li key={event.id} className="relative space-y-0.5">
            <span
              aria-hidden="true"
              className="absolute top-1.5 -left-[1.3125rem] size-2 rounded-full bg-muted-foreground"
            />

            <p className="text-sm font-medium">
              {t(`events.${event.type}`)}

              <span className="font-normal text-muted-foreground">
                {' · '}

                <time dateTime={event.createdAt}>
                  {format.formatExecutionDay(event.createdAt)}
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
};
