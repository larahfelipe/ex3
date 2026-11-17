import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCalendarDay } from './CalendarDay';
import {
  activeNotificationsOf,
  NOTIFICATION_KEY_PATTERN,
  notificationKeyOf,
  visibleNotificationsOf,
  type NotificationReminders
} from './FinanceNotifications';
import type { Expense } from './models';

const day = (value: string) => parseCalendarDay(value) as Date;

const TODAY = day('2026-11-16');

const REMINDERS: NotificationReminders = {
  reminderLeadDays: 3,
  remindOverdue: true,
  remindUpcomingBills: true,
  remindUpcomingInstallments: true
};

let sequence = 0;

const expense = (
  overrides: Partial<Expense> & Pick<Expense, 'dueDate' | 'status'>
): Expense => {
  sequence += 1;

  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    description: `Bill ${sequence}`,
    category: 'HOUSING',
    subcategory: null,
    amount: '100',
    currency: 'BRL',
    entryDate: '2026-10-01',
    paymentMethod: null,
    account: null,
    notes: null,
    settledAmount: '0',
    outstandingAmount: '100',
    settledOn: null,
    cancelledAt: null,
    kind: 'ONE_TIME',
    installmentPlanId: null,
    installmentNumber: null,
    installmentCount: null,
    recurringExpenseId: null,
    occurrenceDate: null,
    isCustomized: false,
    originalDueDate: null,
    creditCardId: null,
    creditCard: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
    ...overrides
  };
};

const notificationsOf = (
  expenses: ReadonlyArray<Expense>,
  reminders: NotificationReminders = REMINDERS
) => activeNotificationsOf({ expenses, reminders, today: TODAY });

describe('notificationKeyOf', () => {
  it('names the condition, the bill and its due date, in a shape the store accepts', () => {
    const bill = expense({ dueDate: '2026-11-10', status: 'OVERDUE' });
    const key = notificationKeyOf('OVERDUE', bill);

    assert.equal(key, `overdue:${bill.id}:2026-11-10`);
    assert.match(key, NOTIFICATION_KEY_PATTERN);
    assert.match(
      notificationKeyOf('DUE_SOON', bill),
      /^due-soon:.+:2026-11-10$/
    );
  });
});

describe('activeNotificationsOf', () => {
  it('raises one notification per overdue bill and per bill due within the lead days, today included', () => {
    const overdue = expense({ dueDate: '2026-11-10', status: 'OVERDUE' });
    const dueToday = expense({ dueDate: '2026-11-16', status: 'PENDING' });
    const dueLast = expense({ dueDate: '2026-11-19', status: 'PENDING' });
    const later = expense({ dueDate: '2026-11-20', status: 'PENDING' });

    const notifications = notificationsOf([overdue, dueToday, dueLast, later]);

    assert.deepEqual(
      notifications.map(({ kind, expense: { id } }) => [kind, id]),
      [
        ['DUE_SOON', dueLast.id],
        ['DUE_SOON', dueToday.id],
        ['OVERDUE', overdue.id]
      ]
    );
    assert.equal(new Set(notifications.map(({ key }) => key)).size, 3);
  });

  it('leaves paid and cancelled bills out', () => {
    assert.deepEqual(
      notificationsOf([
        expense({ dueDate: '2026-11-10', status: 'PAID' }),
        expense({ dueDate: '2026-11-17', status: 'CANCELLED' })
      ]),
      []
    );
  });

  it('follows the reminder switches: overdue, upcoming bills and upcoming installments apart', () => {
    const overdue = expense({ dueDate: '2026-11-10', status: 'OVERDUE' });
    const bill = expense({ dueDate: '2026-11-17', status: 'PENDING' });
    const installment = expense({
      dueDate: '2026-11-17',
      status: 'PENDING',
      kind: 'INSTALLMENT'
    });
    const kindsWith = (switches: Partial<NotificationReminders>) =>
      notificationsOf([overdue, bill, installment], {
        ...REMINDERS,
        ...switches
      }).map(({ expense: { id } }) => id);

    assert.deepEqual(kindsWith({ remindOverdue: false }), [
      bill.id,
      installment.id
    ]);
    assert.deepEqual(kindsWith({ remindUpcomingBills: false }), [
      installment.id,
      overdue.id
    ]);
    assert.deepEqual(kindsWith({ remindUpcomingInstallments: false }), [
      bill.id,
      overdue.id
    ]);
  });

  it('dates each one from the day its condition began, never before the bill was recorded nor after today', () => {
    const notifiedOn = Object.fromEntries(
      notificationsOf([
        expense({
          description: 'overdue',
          dueDate: '2026-11-10',
          status: 'OVERDUE'
        }),
        expense({
          description: 'reminder',
          dueDate: '2026-11-18',
          status: 'PENDING'
        }),
        expense({
          description: 'recorded within the window',
          dueDate: '2026-11-19',
          status: 'PENDING',
          createdAt: new Date('2026-11-16T09:00:00Z')
        }),
        expense({
          description: 'recorded on a later UTC day',
          dueDate: '2026-11-17',
          status: 'PENDING',
          createdAt: new Date('2026-11-17T01:00:00Z')
        })
      ]).map((notification) => [
        notification.expense.description,
        notification.notifiedOn
      ])
    );

    assert.deepEqual(notifiedOn, {
      overdue: '2026-11-11',
      reminder: '2026-11-15',
      'recorded within the window': '2026-11-16',
      'recorded on a later UTC day': '2026-11-16'
    });
  });

  it('lists the newest first, an overdue bill before a reminder of the same day, then by due date', () => {
    const olderOverdue = expense({ dueDate: '2026-11-01', status: 'OVERDUE' });
    const newOverdue = expense({ dueDate: '2026-11-14', status: 'OVERDUE' });
    const reminderLater = expense({ dueDate: '2026-11-19', status: 'PENDING' });
    const reminderSooner = expense({
      dueDate: '2026-11-18',
      status: 'PENDING',
      createdAt: new Date('2026-11-15T10:00:00Z')
    });

    assert.deepEqual(
      notificationsOf([
        olderOverdue,
        reminderLater,
        newOverdue,
        reminderSooner
      ]).map(({ expense: { id } }) => id),
      [reminderLater.id, newOverdue.id, reminderSooner.id, olderOverdue.id]
    );
  });

  it('gives a bill a new key when its due date moves or its reminder turns overdue', () => {
    const bill = expense({ dueDate: '2026-11-17', status: 'PENDING' });
    const [reminder] = notificationsOf([bill]);
    const [moved] = notificationsOf([{ ...bill, dueDate: '2026-11-18' }]);
    const [renamed] = notificationsOf([{ ...bill, description: 'Rent' }]);
    const [overdue] = notificationsOf([
      { ...bill, dueDate: '2026-11-15', status: 'OVERDUE' }
    ]);

    assert.notEqual(moved?.key, reminder?.key);
    assert.equal(renamed?.key, reminder?.key);
    assert.notEqual(overdue?.key, reminder?.key);
  });
});

describe('visibleNotificationsOf', () => {
  it('hides the dismissed ones and marks the read ones', () => {
    const bills = ['2026-11-12', '2026-11-11', '2026-11-10'].map((dueDate) =>
      expense({ dueDate, status: 'OVERDUE' })
    );
    const [read, dismissed, unread] = bills.map((bill) =>
      notificationKeyOf('OVERDUE', bill)
    );
    const at = new Date('2026-11-16T12:00:00Z');

    const visible = visibleNotificationsOf(notificationsOf(bills), [
      { key: String(read), readAt: at, dismissedAt: null },
      { key: String(dismissed), readAt: at, dismissedAt: at },
      { key: 'overdue:gone', readAt: at, dismissedAt: null }
    ]);

    assert.deepEqual(
      visible.map(({ key, isRead }) => [key, isRead]),
      [
        [read, true],
        [unread, false]
      ]
    );
  });
});
