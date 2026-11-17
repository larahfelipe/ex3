import type { LocaleMessages, Messages } from '../catalog';

export default {
  label: 'Notifications',
  unreadCount: '{count, plural, =0 {} other {, # unread}}',
  unread: 'Unread',
  markRead: 'Mark as read',
  markReadNamed: 'Mark as read: {description}',
  markAllRead: 'Mark all as read',
  dismiss: 'Dismiss notification',
  dismissNamed: 'Dismiss notification: {description}',
  clearAll: 'Clear notifications',
  viewBills: 'View bills',
  notifiedOn: '{days, plural, =0 {Today} =1 {Yesterday} other {# days ago}}',
  empty:
    'No notifications for now. Bills that are overdue or due soon show up here.',
  loadFailed: "Couldn't load the notifications",
  markFailed: "Couldn't update the notifications",
  partial: 'The latest {shown, number} of {total, number}'
} as const satisfies LocaleMessages<Messages['notifications']>;
