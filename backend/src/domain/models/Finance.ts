export type ExpenseCategory =
  | 'HOUSING'
  | 'UTILITIES'
  | 'FOOD'
  | 'TRANSPORTATION'
  | 'HEALTH'
  | 'EDUCATION'
  | 'LEISURE'
  | 'SUBSCRIPTIONS'
  | 'FINANCIAL'
  | 'SHOPPING'
  | 'OTHER';

export type PaymentMethod =
  | 'CASH'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'BANK_TRANSFER'
  | 'PIX'
  | 'BOLETO'
  | 'DIRECT_DEBIT'
  | 'OTHER';

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type ExpenseStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED';

export type ExpenseStatusFilter = ExpenseStatus | 'OPEN';

export type ExpenseKind = 'ONE_TIME' | 'INSTALLMENT' | 'RECURRING';

export type InstallmentPlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type RecurringExpenseStatus = 'ACTIVE' | 'ENDED' | 'CANCELLED';

export type FinanceRecordType =
  'EXPENSE' | 'INSTALLMENT_PLAN' | 'RECURRING_EXPENSE';

export type FinanceEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'CANCELLED'
  | 'RESTORED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_CORRECTED'
  | 'PAYMENT_VOIDED'
  | 'RESCHEDULED';

export type CalendarDay = string;

export type CalendarMonth = string;

export type Expense = {
  id: string;
  description: string;
  category: ExpenseCategory;
  subcategory: string | null;
  amount: string;
  currency: string;
  entryDate: CalendarDay;
  dueDate: CalendarDay;
  paymentMethod: PaymentMethod | null;
  account: string | null;
  notes: string | null;
  settledAmount: string;
  outstandingAmount: string;
  settledOn: CalendarDay | null;
  cancelledAt: Date | null;
  kind: ExpenseKind;
  status: ExpenseStatus;
  installmentPlanId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  recurringExpenseId: string | null;
  occurrenceDate: CalendarDay | null;
  isCustomized: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ExpensePayment = {
  id: string;
  expenseId: string;
  amount: string;
  discount: string;
  fees: string;
  paidOn: CalendarDay;
  method: PaymentMethod | null;
  notes: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FinanceEvent = {
  id: string;
  recordType: FinanceRecordType;
  recordId: string;
  type: FinanceEventType;
  changes: Record<string, unknown>;
  createdAt: Date;
};

export type ExpenseDescription = Pick<
  Expense,
  | 'description'
  | 'category'
  | 'subcategory'
  | 'paymentMethod'
  | 'account'
  | 'notes'
>;

export type InstallmentPlan = ExpenseDescription & {
  id: string;
  currency: string;
  frequency: RecurrenceFrequency;
  principalAmount: string | null;
  entryDate: CalendarDay;
  cancelledAt: Date | null;
  status: InstallmentPlanStatus;
  installmentCount: number;
  totalAmount: string;
  settledAmount: string;
  outstandingAmount: string;
  financingCost: string | null;
  paidInstallments: number;
  remainingInstallments: number;
  nextDueDate: CalendarDay | null;
  nextInstallmentNumber: number | null;
  firstDueDate: CalendarDay | null;
  lastDueDate: CalendarDay | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RecurringExpense = ExpenseDescription & {
  id: string;
  amount: string;
  isVariable: boolean;
  currency: string;
  frequency: RecurrenceFrequency;
  startDate: CalendarDay;
  endDate: CalendarDay | null;
  cancelledAt: Date | null;
  status: RecurringExpenseStatus;
  monthlyEquivalent: string;
  nextDueDate: CalendarDay | null;
  createdAt: Date;
  updatedAt: Date;
};
