import type {
  GetFinanceNotificationsResponseData,
  MarkFinanceNotificationsRequestPayload
} from '@/app/api/v1/finances';

type NotificationMark = Omit<MarkFinanceNotificationsRequestPayload, 'today'>;

export const feedWithMark = (
  feed: GetFinanceNotificationsResponseData,
  { action, keys }: NotificationMark
): GetFinanceNotificationsResponseData => {
  if (keys === undefined)
    return action === 'READ'
      ? {
          ...feed,
          notifications: feed.notifications.map((notification) => ({
            ...notification,
            isRead: true
          })),
          unreadCount: 0
        }
      : { notifications: [], unreadCount: 0, total: 0 };

  const marked = new Set(keys);
  const targets = feed.notifications.filter(({ key }) => marked.has(key));
  const newlyRead = targets.filter(({ isRead }) => !isRead).length;

  return action === 'READ'
    ? {
        ...feed,
        notifications: feed.notifications.map((notification) =>
          marked.has(notification.key)
            ? { ...notification, isRead: true }
            : notification
        ),
        unreadCount: feed.unreadCount - newlyRead
      }
    : {
        notifications: feed.notifications.filter(({ key }) => !marked.has(key)),
        unreadCount: feed.unreadCount - newlyRead,
        total: feed.total - targets.length
      };
};
