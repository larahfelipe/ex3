import {
  addDays,
  formatCalendarDay,
  maxDay,
  minDay,
  parseCalendarDay
} from './CalendarDay';
import { remindsUpcoming, type UpcomingReminders } from './FinanceAggregates';
import type { CalendarDay, Expense } from './models';

export type FinanceNotificationKind = 'OVERDUE' | 'DUE_SOON';

export type NotificationMarkAction = 'READ' | 'DISMISS';

export type NotificationReminders = UpcomingReminders &
  Record<'remindOverdue', boolean> &
  Record<'reminderLeadDays', number>;

export type NotificationMarks = Record<'key', string> &
  Record<'readAt' | 'dismissedAt', Date | null>;

export type ActiveNotification = Record<'key', string> &
  Record<'kind', FinanceNotificationKind> &
  Record<'notifiedOn', CalendarDay> &
  Record<'expense', Expense>;

export type FinanceNotification = ActiveNotification &
  Record<'isRead', boolean>;

const KEY_PREFIXES: Record<FinanceNotificationKind, string> = {
  OVERDUE: 'overdue',
  DUE_SOON: 'due-soon'
};

export const NOTIFICATION_KEY_PATTERN =
  /^(overdue|due-soon):[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$/;

export const notificationKeyOf = (
  kind: FinanceNotificationKind,
  { id, dueDate }: Pick<Expense, 'id' | 'dueDate'>
) => `${KEY_PREFIXES[kind]}:${id}:${dueDate}`;

const kindOf = (
  { status, kind, dueDate }: Pick<Expense, 'status' | 'kind' | 'dueDate'>,
  reminders: NotificationReminders,
  today: Date
): FinanceNotificationKind | null => {
  if (status === 'OVERDUE') return reminders.remindOverdue ? 'OVERDUE' : null;

  if (status !== 'PENDING' || !remindsUpcoming(kind, reminders)) return null;

  const lastReminded = formatCalendarDay(
    addDays(today, reminders.reminderLeadDays)
  );

  return dueDate <= lastReminded ? 'DUE_SOON' : null;
};

const notifiedOnOf = (
  kind: FinanceNotificationKind,
  { dueDate, createdAt }: Pick<Expense, 'dueDate' | 'createdAt'>,
  reminders: NotificationReminders,
  today: Date
): CalendarDay => {
  const due = parseCalendarDay(dueDate) ?? today;
  const began =
    kind === 'OVERDUE'
      ? addDays(due, 1)
      : addDays(due, -reminders.reminderLeadDays);
  const recorded = parseCalendarDay(formatCalendarDay(createdAt)) ?? began;

  return formatCalendarDay(minDay(maxDay(began, recorded), today));
};

const KIND_ORDER: Record<FinanceNotificationKind, number> = {
  OVERDUE: 0,
  DUE_SOON: 1
};

const byNewest = (left: ActiveNotification, right: ActiveNotification) =>
  right.notifiedOn.localeCompare(left.notifiedOn) ||
  KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
  left.expense.dueDate.localeCompare(right.expense.dueDate) ||
  left.key.localeCompare(right.key);

export const activeNotificationsOf = ({
  expenses,
  reminders,
  today
}: Record<'expenses', ReadonlyArray<Expense>> &
  Record<'reminders', NotificationReminders> &
  Record<'today', Date>): Array<ActiveNotification> =>
  expenses
    .flatMap((expense) => {
      const kind = kindOf(expense, reminders, today);

      return kind === null
        ? []
        : [
            {
              key: notificationKeyOf(kind, expense),
              kind,
              notifiedOn: notifiedOnOf(kind, expense, reminders, today),
              expense
            }
          ];
    })
    .sort(byNewest);

export const visibleNotificationsOf = (
  active: ReadonlyArray<ActiveNotification>,
  marks: ReadonlyArray<NotificationMarks>
): Array<FinanceNotification> => {
  const marksByKey = new Map(marks.map((mark) => [mark.key, mark]));

  return active.flatMap((notification) => {
    const mark = marksByKey.get(notification.key);

    return mark?.dismissedAt
      ? []
      : [{ ...notification, isRead: Boolean(mark?.readAt) }];
  });
};
