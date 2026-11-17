import type {
  Expense,
  FinanceNotification,
  GetFinanceNotificationsResponseData
} from '@/app/api/v1/finances';

export const expenseOf = (
  overrides: Partial<Expense> & Pick<Expense, 'id' | 'dueDate'>
): Expense => ({
  description: 'Aluguel',
  category: 'HOUSING',
  subcategory: null,
  paymentMethod: null,
  account: null,
  notes: null,
  amount: '1500.00',
  currency: 'BRL',
  entryDate: '2026-11-01',
  settledAmount: '0.00',
  outstandingAmount: '1500.00',
  settledOn: null,
  cancelledAt: null,
  kind: 'ONE_TIME',
  status: 'PENDING',
  installmentPlanId: null,
  installmentNumber: null,
  installmentCount: null,
  recurringExpenseId: null,
  occurrenceDate: null,
  isCustomized: false,
  originalDueDate: null,
  creditCardId: null,
  creditCard: null,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides
});

export const notificationOf = (
  kind: FinanceNotification['kind'],
  expense: Expense,
  overrides: Partial<FinanceNotification> = {}
): FinanceNotification => ({
  key: `${kind === 'OVERDUE' ? 'overdue' : 'due-soon'}:${expense.id}:${expense.dueDate}`,
  kind,
  notifiedOn: '2026-11-16',
  isRead: false,
  expense,
  ...overrides
});

export const feedOf = (
  notifications: Array<FinanceNotification>
): GetFinanceNotificationsResponseData => ({
  notifications,
  unreadCount: notifications.filter(({ isRead }) => !isRead).length,
  total: notifications.length
});
