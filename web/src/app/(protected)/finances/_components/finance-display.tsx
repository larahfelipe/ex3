import {
  useId,
  useState,
  type ComponentProps,
  type FC,
  type ReactNode
} from 'react';

import Link from 'next/link';

import {
  ArrowRight,
  Ban,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleStop,
  Clock,
  Pencil,
  Plus,
  RotateCcw,
  Undo2,
  type LucideIcon
} from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
  FinanceEvent,
  FinanceEventType,
  InstallmentPlanStatus,
  PaymentMethod,
  RecurringExpenseStatus
} from '@/app/api/v1/finances';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUS_TONES,
  INSTALLMENT_PLAN_STATUS_TONES,
  PAYMENT_METHODS,
  RECURRING_EXPENSE_STATUS_TONES,
  RETIRED_EXPENSE_CATEGORIES
} from '@/common/constants';
import { Money } from '@/components/financial';
import { Button, TruncatedText } from '@/components/ui';
import { useFormat, type Format } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import type { Translator } from '@/i18n/translator';
import { daysBetween } from '@/lib/dates';
import { isStorableDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

type ChangeEntry = Record<'from' | 'to', unknown>;

type RecordedCard = Record<'name' | 'lastFourDigits', string>;

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
  'originalDueDate',
  'creditCard',
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

export const NextPayment: FC<
  Record<'expense', Expense> &
    Record<'today', string> &
    Record<'shownDueDate', string | null> &
    Record<'payLabel', ReactNode> &
    Record<'onPay', VoidFunction>
> = ({ expense, today, shownDueDate, payLabel, onPay }) => {
  const t = useTranslations('finances');
  const { dueDate, outstandingAmount, currency, status } = expense;
  const distance = dueDistanceOf(dueDate, today, t);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{t('display.toPay')}</p>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold tabular-nums">
            <Money value={outstandingAmount} currency={currency} />
          </span>

          {dueDate !== shownDueDate && (
            <span
              className={cn(
                'text-sm',
                status === 'OVERDUE' ? 'text-negative' : 'text-muted-foreground'
              )}
            >
              {t.rich('display.toPayDue', {
                day: () => <CalendarDayText day={dueDate} />,
                distance: distance ?? 'none'
              })}
            </span>
          )}

          <ExpenseStatusBadge status={status} />
        </p>
      </div>

      <Button size="sm" className="max-sm:w-full" onClick={onPay}>
        {payLabel}
      </Button>
    </div>
  );
};

const ROW_LINK_CLASS =
  'block rounded-sm font-semibold ring-offset-background wrap-anywhere after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

export const RowLink: FC<
  Omit<ComponentProps<typeof Link>, 'children' | 'className'> &
    Record<'children', string>
> = ({ children, ...props }) => (
  <Link className={ROW_LINK_CLASS} {...props}>
    <TruncatedText className="relative z-10 line-clamp-2">
      {children}
    </TruncatedText>
  </Link>
);

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
  'originalDueDate',
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

const isRetiredCategory = (
  value: string
): value is (typeof RETIRED_EXPENSE_CATEGORIES)[number] =>
  RETIRED_EXPENSE_CATEGORIES.some((category) => category === value);

const isChangedField = (field: string): field is ChangedField =>
  CHANGED_FIELDS.some((known) => known === field);

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
  if (typeof value === 'number') return String(value);
  if (field === 'creditCard' && isRecordedCard(value))
    return t('history.card', {
      name: value.name,
      lastFour: value.lastFourDigits
    });
  if (typeof value !== 'string') return JSON.stringify(value);
  if (MONEY_FIELDS.has(field) && isStorableDecimal(value))
    return formatMoney(value, currency);
  if (DAY_FIELDS.has(field)) return formatCalendarDay(value) ?? value;
  if (PAYMENT_METHOD_FIELDS.has(field) && isPaymentMethod(value))
    return t(`paymentMethods.${value}`);
  if (field === 'category' && isExpenseCategory(value))
    return t(`categories.${value}`);
  if (field === 'category' && isRetiredCategory(value))
    return t(`retiredCategories.${value}`);

  return value;
};

const isRecordedCard = (value: unknown): value is RecordedCard =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  'lastFourDigits' in value &&
  typeof value.lastFourDigits === 'string';

const isChangeEntry = (value: unknown): value is ChangeEntry =>
  typeof value === 'object' &&
  value !== null &&
  'from' in value &&
  'to' in value;

const countOf = (value: unknown) => (Array.isArray(value) ? value.length : 0);

type ChangeRow = Record<'field' | 'label' | 'from' | 'to', string>;

type EventDetails = Record<'changes', Array<ChangeRow>> &
  Record<'fromDay' | 'summary', string | null>;

const EVENT_PREVIEW_COUNT = 4;

const EVENT_MARKERS: Record<
  FinanceEventType,
  Record<'icon', LucideIcon> & Record<'tone', string>
> = {
  CREATED: { icon: Plus, tone: 'text-foreground' },
  UPDATED: { icon: Pencil, tone: 'text-foreground' },
  CANCELLED: { icon: Ban, tone: 'text-muted-foreground' },
  RESTORED: { icon: RotateCcw, tone: 'text-info' },
  PAYMENT_RECORDED: { icon: CircleCheck, tone: 'text-positive' },
  PAYMENT_CORRECTED: { icon: Pencil, tone: 'text-info' },
  PAYMENT_VOIDED: { icon: Undo2, tone: 'text-negative' },
  RESCHEDULED: { icon: CalendarClock, tone: 'text-info' }
};

export const eventDetailsOf = (
  { type, changes }: Pick<FinanceEvent, 'type' | 'changes'>,
  currency: string,
  t: FinancesTranslator,
  format: Format
): EventDetails => {
  const recordedText = (field: string, value: unknown) =>
    recordedTextOf(field, value, currency, t, format);
  const fromDay =
    typeof changes.effectiveFrom === 'string'
      ? recordedText('effectiveFrom', changes.effectiveFrom)
      : null;
  const changedFields = Object.entries(changes).filter(([, change]) =>
    isChangeEntry(change)
  ) as Array<[string, ChangeEntry]>;

  if (changedFields.length > 0)
    return {
      changes: changedFields.map(([field, { from, to }]) => ({
        field,
        label: isChangedField(field) ? t(`changedFields.${field}`) : field,
        from: recordedText(field, from),
        to: recordedText(field, to)
      })),
      fromDay,
      summary: null
    };

  const {
    amount,
    paidOn,
    replaced,
    scheduled,
    removedOccurrences,
    cancelledOccurrences
  } = changes;

  const summaryOf = () => {
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

  return { changes: [], fromDay: null, summary: summaryOf() };
};

export const describeEvent = (
  event: Pick<FinanceEvent, 'type' | 'changes'>,
  currency: string,
  t: FinancesTranslator,
  format: Format
) => {
  const { changes, fromDay, summary } = eventDetailsOf(
    event,
    currency,
    t,
    format
  );

  if (changes.length === 0) return summary;

  const changesText = changes
    .map(({ label, from, to }) =>
      t('history.change', { field: label, from, to })
    )
    .join('; ');

  return fromDay === null
    ? changesText
    : t('history.changesFrom', { changes: changesText, day: fromDay });
};

const EventChanges: FC<Record<'changes', Array<ChangeRow>>> = ({ changes }) => {
  const t = useTranslations('finances.history');

  return (
    <dl className="space-y-1 text-sm">
      {changes.map(({ field, label, from, to }) => (
        <div key={field} className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground first-letter:uppercase">
            {label}
          </dt>

          <dd className="min-w-0 wrap-anywhere">
            {t.rich('changeValue', {
              from: () => <span className="text-muted-foreground">{from}</span>,
              to: () => <span className="font-medium">{to}</span>,
              arrow: () => (
                <ArrowRight
                  aria-hidden="true"
                  className="mx-1 inline size-3.5 align-[-0.125em] text-muted-foreground"
                />
              ),
              hidden: srOnly
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
};

const HistoryEntry: FC<
  Record<'event', FinanceEvent> &
    Record<'currency', string> &
    Record<'isLast', boolean>
> = ({ event, currency, isLast }) => {
  const t = useTranslations('finances');
  const format = useFormat();
  const { changes, fromDay, summary } = eventDetailsOf(
    event,
    currency,
    t,
    format
  );
  const { icon: Icon, tone } = EVENT_MARKERS[event.type];

  return (
    <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute top-7 bottom-1 left-3 w-px -translate-x-1/2 bg-border"
        />
      )}

      <span
        aria-hidden="true"
        className="flex size-6 items-center justify-center rounded-full border bg-surface-elevated"
      >
        <Icon className={cn('size-3.5', tone)} />
      </span>

      <div className="min-w-0 space-y-1 pt-0.5">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="font-medium">{t(`events.${event.type}`)}</span>

          <time
            dateTime={event.createdAt}
            className="text-xs text-muted-foreground tabular-nums"
          >
            {format.formatExecutionDay(event.createdAt)}
          </time>
        </p>

        {changes.length > 0 && <EventChanges changes={changes} />}

        {fromDay !== null && (
          <p className="text-xs text-muted-foreground">
            {t('history.effectiveFrom', { day: fromDay })}
          </p>
        )}

        {summary !== null && (
          <p className="text-sm text-muted-foreground wrap-anywhere">
            {summary}
          </p>
        )}
      </div>
    </li>
  );
};

export const FinanceHistory: FC<
  Record<'events', ReadonlyArray<FinanceEvent>> & Record<'currency', string>
> = ({ events, currency }) => {
  const t = useTranslations('finances.history');
  const listId = useId();
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  const canFold = events.length > EVENT_PREVIEW_COUNT + 1;
  const shownEvents =
    canFold && !isExpanded ? events.slice(0, EVENT_PREVIEW_COUNT) : events;

  return (
    <div className="space-y-3">
      <ol id={listId}>
        {shownEvents.map((event, index) => (
          <HistoryEntry
            key={event.id}
            event={event}
            currency={currency}
            isLast={index === shownEvents.length - 1}
          />
        ))}
      </ol>

      {canFold && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={isExpanded}
          aria-controls={listId}
          className="ml-6 text-muted-foreground"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded
            ? t('showLatest', { count: EVENT_PREVIEW_COUNT })
            : t('showAll', { count: events.length })}
        </Button>
      )}
    </div>
  );
};
