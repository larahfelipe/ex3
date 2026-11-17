import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  expenseOf,
  feedOf,
  notificationOf
} from '@/test/fixtures/finance-notifications';

import { feedWithMark } from './finance-notifications';

const overdue = notificationOf(
  'OVERDUE',
  expenseOf({
    id: '00000000-0000-4000-8000-000000000001',
    dueDate: '2026-11-14',
    status: 'OVERDUE'
  })
);
const soon = notificationOf(
  'DUE_SOON',
  expenseOf({
    id: '00000000-0000-4000-8000-000000000002',
    dueDate: '2026-11-17'
  })
);
const alreadyRead = notificationOf(
  'DUE_SOON',
  expenseOf({
    id: '00000000-0000-4000-8000-000000000003',
    dueDate: '2026-11-18'
  }),
  { isRead: true }
);
const feed = feedOf([overdue, soon, alreadyRead]);

describe('a notification feed with a mark applied', () => {
  it('reads the listed keys and counts only the newly read ones', () => {
    const marked = feedWithMark(feed, {
      action: 'READ',
      keys: [overdue.key, alreadyRead.key]
    });

    assert.deepEqual(
      marked.notifications.map(({ isRead }) => isRead),
      [true, false, true]
    );
    assert.equal(marked.unreadCount, 1);
    assert.equal(marked.total, 3);
  });

  it('drops the dismissed keys from the list and from both counts', () => {
    const marked = feedWithMark(feed, {
      action: 'DISMISS',
      keys: [soon.key, alreadyRead.key]
    });

    assert.deepEqual(marked.notifications, [overdue]);
    assert.equal(marked.unreadCount, 1);
    assert.equal(marked.total, 1);
  });

  it('covers every notification, those past the page included, when no key is given', () => {
    const paged = { ...feed, unreadCount: 60, total: 70 };

    const read = feedWithMark(paged, { action: 'READ' });
    const cleared = feedWithMark(paged, { action: 'DISMISS' });

    assert.ok(read.notifications.every(({ isRead }) => isRead));
    assert.equal(read.unreadCount, 0);
    assert.equal(read.total, 70);
    assert.deepEqual(cleared, { notifications: [], unreadCount: 0, total: 0 });
  });

  it('ignores keys the feed no longer lists', () => {
    assert.deepEqual(
      feedWithMark(feed, {
        action: 'DISMISS',
        keys: ['overdue:00000000-0000-4000-8000-000000000009:2026-11-01']
      }),
      feed
    );
  });
});
