import { FinanceLimits } from '@/config/Constants';
import { addDays } from '@/domain/CalendarDay';
import {
  activeNotificationsOf,
  visibleNotificationsOf,
  type FinanceNotification
} from '@/domain/FinanceNotifications';
import type {
  FinanceNotificationRepository,
  FinanceReportRepository,
  RecurringExpenseRepository
} from '@/infra/database';

import { generateDueOccurrences } from './OccurrenceHorizon';

export type NotificationSources = Record<
  'financeReportRepository',
  FinanceReportRepository
> &
  Record<'recurringExpenseRepository', RecurringExpenseRepository> &
  Record<'financeNotificationRepository', FinanceNotificationRepository>;

export type NotificationFeed = Record<
  'notifications',
  Array<FinanceNotification>
> &
  Record<'unreadCount' | 'total', number>;

type FeedQuery = Record<'userId', string> & Record<'today', Date>;

export const activeNotificationsFor = async (
  { financeReportRepository, recurringExpenseRepository }: NotificationSources,
  { userId, today }: FeedQuery
) => {
  await generateDueOccurrences(recurringExpenseRepository, { userId, today });

  const reminders = await financeReportRepository.getSettings(userId);
  const expenses = await financeReportRepository.getOpenDueThrough({
    userId,
    through: addDays(today, reminders.reminderLeadDays),
    today
  });

  return activeNotificationsOf({ expenses, reminders, today });
};

export const notificationFeedFor = async (
  sources: NotificationSources,
  query: FeedQuery
): Promise<NotificationFeed> => {
  const active = await activeNotificationsFor(sources, query);
  const marks = await sources.financeNotificationRepository.getMarks({
    userId: query.userId,
    activeKeys: active.map(({ key }) => key)
  });
  const visible = visibleNotificationsOf(active, marks);

  return {
    notifications: visible.slice(0, FinanceLimits.NOTIFICATION_ITEMS_LIMIT),
    unreadCount: visible.filter(({ isRead }) => !isRead).length,
    total: visible.length
  };
};
