import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NavigationHeader } from '@/components/sidebar';
import { calendarDayOf, currentInstant } from '@/lib/dates';
import { queryKeys } from '@/lib/react-query';
import {
  expenseOf,
  feedOf,
  notificationOf
} from '@/test/fixtures/finance-notifications';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';
import { withQueryData } from '@/test/queries';

import { NotificationItem } from './notifications-popover';

const TODAY = '2026-11-16';

const EXPENSE_ID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const noop = () => undefined;

const itemOf = (notification: ReturnType<typeof notificationOf>) =>
  renderWithIntl(
    <ul>
      <NotificationItem
        notification={notification}
        today={TODAY}
        onOpen={noop}
        onMarkRead={noop}
        onDismiss={noop}
      />
    </ul>
  );

describe('a notification', () => {
  it('names its bill, how long it is overdue and what is left to pay, and links to the bill', () => {
    const markup = itemOf(
      notificationOf(
        'OVERDUE',
        expenseOf({
          id: EXPENSE_ID,
          description: 'Aluguel',
          dueDate: '2026-11-14',
          status: 'OVERDUE',
          outstandingAmount: '1200.50'
        }),
        { notifiedOn: '2026-11-15' }
      )
    );

    assert.match(
      markup,
      new RegExp(`href="/finances/bills\\?expense=${EXPENSE_ID}"`)
    );
    assert.equal(
      textOf(markup),
      `Não lidaAluguelOntemVenceu há 2 dias · ${nbsp('R$ 1.200,50')}`
    );
    assert.match(markup, /aria-label="Marcar como lida: Aluguel"/);
    assert.match(markup, /aria-label="Dispensar notificação: Aluguel"/);
  });

  it('says when a bill falls due soon, and offers no read mark once read', () => {
    const markup = itemOf(
      notificationOf(
        'DUE_SOON',
        expenseOf({
          id: EXPENSE_ID,
          description: 'Internet',
          dueDate: '2026-11-17'
        }),
        { isRead: true, notifiedOn: TODAY }
      )
    );

    assert.match(textOf(markup), /^InternetHojeVence amanhã/);
    assert.doesNotMatch(markup, /Não lida|Marcar como lida/);
    assert.match(markup, /aria-label="Dispensar notificação: Internet"/);
  });
});

describe('the phone header', () => {
  it('counts the unread notifications on its trigger, for the eye and for a screen reader', () => {
    const today = calendarDayOf(currentInstant());
    const unread = [1, 2, 3].map((n) =>
      notificationOf(
        'OVERDUE',
        expenseOf({
          id: `00000000-0000-4000-8000-00000000000${n}`,
          dueDate: '2026-11-01',
          status: 'OVERDUE'
        })
      )
    );
    const markup = renderWithIntl(
      withQueryData(
        [[queryKeys.financeNotifications(today), feedOf(unread)]],
        <NavigationHeader />
      )
    );

    assert.match(markup, /aria-haspopup="dialog"/);
    assert.match(textOf(markup), /EX3.*3Notificações, 3 não lidas/);
  });

  it('shows no badge when every notification is read', () => {
    const today = calendarDayOf(currentInstant());
    const markup = renderWithIntl(
      withQueryData(
        [[queryKeys.financeNotifications(today), feedOf([])]],
        <NavigationHeader />
      )
    );

    assert.match(textOf(markup), /EX3Notificações$/);
  });
});
