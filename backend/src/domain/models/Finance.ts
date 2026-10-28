export type ExpenseCategory =
  | 'HOUSING'
  | 'UTILITIES'
  | 'FOOD'
  | 'TRANSPORTATION'
  | 'HEALTH'
  | 'EDUCATION'
  | 'LEISURE'
  | 'SUBSCRIPTIONS'
  | 'INSURANCE'
  | 'TAXES'
  | 'DEBT'
  | 'SHOPPING'
  | 'PERSONAL_CARE'
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

/** Derived on every read from the due date, the settled amount and the reference day; never stored. */
export type ExpenseStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED';

/** A list filter: one status, or `OPEN` for every expense still owed, pending or overdue. */
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

/** A calendar day, `YYYY-MM-DD`, with no time zone. */
export type CalendarDay = string;

/** A calendar month, `YYYY-MM`. */
export type CalendarMonth = string;

/**
 * Monetary values are decimal strings, exact to the scale of their columns.
 * `settledAmount` is what the active payments cleared (amount plus discount),
 * `outstandingAmount` what is still owed.
 */
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

/** The fields a person describes a bill with, shared by expenses, plans and series. */
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
  /** `totalAmount − principalAmount`: interest and fees when positive, a discount when negative. */
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
  /** The amount spread over a month: weekly × 52 ÷ 12, yearly ÷ 12, truncated to the currency's minor unit. */
  monthlyEquivalent: string;
  nextDueDate: CalendarDay | null;
  createdAt: Date;
  updatedAt: Date;
};
