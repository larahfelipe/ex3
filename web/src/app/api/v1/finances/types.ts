import type {
  DecimalString,
  Page,
  PageParams,
  WithId,
  WithMessage,
  WithTimestamps
} from '@/types';

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

export type ExpenseStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED';

/** A status, or `OPEN`: pending and overdue alike, whatever is still owed. */
export type ExpenseStatusFilter = ExpenseStatus | 'OPEN';

export type ExpenseKind = 'ONE_TIME' | 'INSTALLMENT' | 'RECURRING';

export type InstallmentPlanStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type RecurringExpenseStatus = 'ACTIVE' | 'ENDED' | 'CANCELLED';

export type FinanceEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'CANCELLED'
  | 'RESTORED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_CORRECTED'
  | 'PAYMENT_VOIDED'
  | 'RESCHEDULED';

export type ExpenseSortField =
  'dueDate' | 'amount' | 'description' | 'createdAt';

export type SortOrder = 'asc' | 'desc';

/** A calendar day, `YYYY-MM-DD`, with no time zone. */
export type CalendarDay = string;

/** A calendar month, `YYYY-MM`. */
export type CalendarMonth = string;

/**
 * The browser's own day, which decides what is overdue. The API accepts it
 * within a day of its UTC day, the span of the world's time zones.
 */
export type ReferenceDayParams = Record<'today', CalendarDay>;

export type ExpenseDescription = {
  description: string;
  category: ExpenseCategory;
  subcategory: string | null;
  paymentMethod: PaymentMethod | null;
  account: string | null;
  notes: string | null;
};

export type Expense = WithId &
  WithTimestamps &
  ExpenseDescription & {
    amount: DecimalString;
    currency: string;
    entryDate: CalendarDay;
    dueDate: CalendarDay;
    settledAmount: DecimalString;
    outstandingAmount: DecimalString;
    settledOn: CalendarDay | null;
    cancelledAt: string | null;
    kind: ExpenseKind;
    status: ExpenseStatus;
    installmentPlanId: string | null;
    installmentNumber: number | null;
    installmentCount: number | null;
    recurringExpenseId: string | null;
    occurrenceDate: CalendarDay | null;
    isCustomized: boolean;
  };

export type ExpensePayment = WithId &
  WithTimestamps & {
    expenseId: string;
    amount: DecimalString;
    discount: DecimalString;
    fees: DecimalString;
    paidOn: CalendarDay;
    method: PaymentMethod | null;
    notes: string | null;
    voidedAt: string | null;
  };

export type FinanceEvent = WithId & {
  recordType: 'EXPENSE' | 'INSTALLMENT_PLAN' | 'RECURRING_EXPENSE';
  recordId: string;
  type: FinanceEventType;
  changes: Record<string, unknown>;
  createdAt: string;
};

export type ExpenseDetail = Expense &
  Record<'payments', Array<ExpensePayment>> &
  Record<'history', Array<FinanceEvent>>;

export type ListedPayment = ExpensePayment &
  Pick<Expense, 'description' | 'category' | 'currency'>;

export type InstallmentPlan = WithId &
  WithTimestamps &
  ExpenseDescription & {
    currency: string;
    frequency: RecurrenceFrequency;
    principalAmount: DecimalString | null;
    entryDate: CalendarDay;
    cancelledAt: string | null;
    status: InstallmentPlanStatus;
    installmentCount: number;
    totalAmount: DecimalString;
    settledAmount: DecimalString;
    outstandingAmount: DecimalString;
    financingCost: string | null;
    paidInstallments: number;
    remainingInstallments: number;
    nextDueDate: CalendarDay | null;
    nextInstallmentNumber: number | null;
    firstDueDate: CalendarDay | null;
    lastDueDate: CalendarDay | null;
  };

/** `keptThroughInstallment`: the last installment a reschedule keeps, the last with any payment, voided ones included. */
export type InstallmentPlanDetail = InstallmentPlan &
  Record<'installments', Array<Expense>> &
  Record<'keptThroughInstallment', number | null> &
  Record<'history', Array<FinanceEvent>>;

export type RecurringExpense = WithId &
  WithTimestamps &
  ExpenseDescription & {
    amount: DecimalString;
    isVariable: boolean;
    currency: string;
    frequency: RecurrenceFrequency;
    startDate: CalendarDay;
    endDate: CalendarDay | null;
    cancelledAt: string | null;
    status: RecurringExpenseStatus;
    monthlyEquivalent: DecimalString;
    nextDueDate: CalendarDay | null;
  };

export type RecurringExpenseDetail = RecurringExpense &
  Record<'history', Array<FinanceEvent>>;

export type AmountCount = Record<'amount', DecimalString> &
  Record<'count', number>;

export type CurrencyAmount = Record<'currency', string> &
  Record<'amount', DecimalString>;

/** `percent` is a fraction of the previous value, null when that was zero. */
export type Change = Record<'amount', DecimalString> &
  Record<'percent', DecimalString | null>;

export type PeriodTotals = Record<
  'scheduled' | 'paid' | 'outstanding' | 'overdue',
  AmountCount
> &
  Record<'settled' | 'fees' | 'discounts', DecimalString>;

export type MonthlyFigures = Record<'month', CalendarMonth> &
  Record<'scheduled' | 'paid' | 'outstanding' | 'overdue', DecimalString>;

export type CategoryFigures = Record<'category', ExpenseCategory> &
  Record<'scheduled' | 'paid', DecimalString> &
  Record<'share', DecimalString | null>;

export type KindFigures = Record<'kind', ExpenseKind> &
  Record<'scheduled' | 'paid', DecimalString>;

export type CommitmentFigures = Record<'month', CalendarMonth> &
  Record<'oneTime' | 'installments' | 'recurring' | 'total', DecimalString>;

export type CalendarDayFigures = Record<'date', CalendarDay> &
  Record<'count' | 'paidCount' | 'overdueCount', number> &
  Record<
    'totals',
    Array<CurrencyAmount & Record<'outstanding', DecimalString>>
  >;

export type AlertGroup = Record<'count', number> &
  Record<'totals', Array<CurrencyAmount>> &
  Record<'items', Array<Expense>>;

export type FinanceSettings = Record<'reminderLeadDays', number> &
  Record<
    'remindOverdue' | 'remindUpcomingBills' | 'remindUpcomingInstallments',
    boolean
  >;

export type ExpenseFilters = PageParams & {
  sortBy?: ExpenseSortField;
  sortOrder?: SortOrder;
  search?: string;
  status?: ExpenseStatusFilter;
  kind?: ExpenseKind;
  category?: ExpenseCategory;
  currency?: string;
  dueFrom?: CalendarDay;
  dueTo?: CalendarDay;
  minAmount?: string;
  maxAmount?: string;
  installmentPlanId?: string;
  recurringExpenseId?: string;
};

export type GetExpensesRequestParams = ExpenseFilters & ReferenceDayParams;

export type GetExpensesResponseData = Page<Expense>;

export type GetExpenseResponseData = ExpenseDetail;

export type CreateExpenseRequestPayload = ExpenseDescription &
  Record<'amount' | 'currency' | 'dueDate', string>;

export type CreateExpenseResponseData = WithId & WithMessage;

export type UpdateExpenseRequestPayload = Partial<
  ExpenseDescription &
    Record<'amount' | 'dueDate', string> &
    Record<'cancelled', boolean>
>;

export type UpdateExpenseResponseData = WithMessage;

export type DeleteExpenseResponseData = WithMessage;

export type PaymentEntryPayload = Record<
  'amount' | 'discount' | 'fees' | 'paidOn',
  string
> &
  Record<'method', PaymentMethod | null> &
  Record<'notes', string | null>;

export type UpdatePaymentRequestPayload = Partial<PaymentEntryPayload>;

export type RecordPaymentResponseData = WithMessage &
  Record<'payment', ExpensePayment>;

export type UpdatePaymentResponseData = RecordPaymentResponseData;

export type VoidPaymentResponseData = WithMessage;

export type PaymentFilters = PageParams & {
  currency?: string;
  paidFrom?: CalendarDay;
  paidTo?: CalendarDay;
  includeVoided?: boolean;
};

export type GetPaymentsResponseData = Page<ListedPayment>;

export type InstallmentPlanFilters = PageParams & {
  currency?: string;
  status?: InstallmentPlanStatus;
};

export type GetInstallmentPlansResponseData = Page<InstallmentPlan>;

export type GetInstallmentPlanResponseData = InstallmentPlanDetail;

/** Exactly one of the two amounts: the sum of the installments or each one's. */
export type CreateInstallmentPlanRequestPayload = ExpenseDescription &
  Record<'currency' | 'firstDueDate', string> &
  Record<'frequency', RecurrenceFrequency> &
  Record<'installmentCount', number> &
  Record<'principalAmount', string | null> &
  (Record<'totalAmount', string> | Record<'installmentAmount', string>);

export type CreateInstallmentPlanResponseData = WithId & WithMessage;

export type UpdateInstallmentPlanRequestPayload = Partial<
  ExpenseDescription & Record<'principalAmount', string | null>
>;

export type RescheduleInstallmentPlanRequestPayload = Record<
  'remainingAmount' | 'nextDueDate',
  string
> &
  Record<'remainingCount', number>;

export type InstallmentPlanChangeResponseData = WithMessage;

export type RecurringExpenseFilters = PageParams & {
  currency?: string;
  status?: RecurringExpenseStatus;
};

export type GetRecurringExpensesResponseData = Page<RecurringExpense>;

export type GetRecurringExpenseResponseData = RecurringExpenseDetail;

export type CreateRecurringExpenseRequestPayload = ExpenseDescription &
  Record<'amount' | 'currency' | 'startDate', string> &
  Record<'isVariable', boolean> &
  Record<'frequency', RecurrenceFrequency> &
  Record<'endDate', string | null>;

export type CreateRecurringExpenseResponseData = WithId & WithMessage;

/** Applies to the occurrences from `effectiveFrom` on that have no payments and were not edited on their own. */
export type UpdateRecurringExpenseRequestPayload = Partial<
  ExpenseDescription &
    Record<'amount' | 'effectiveFrom', string> &
    Record<'isVariable', boolean> &
    Record<'endDate', string | null>
>;

export type CancelRecurringExpenseRequestPayload = Partial<
  Record<'effectiveFrom', string>
>;

export type RecurringExpenseChangeResponseData = WithMessage;

export type FinanceSummaryParams = ReferenceDayParams &
  Partial<Record<'currency', string>>;

export type GetFinanceSummaryResponseData = {
  currency: string;
  currencies: Array<string>;
  today: CalendarDay;
  month: CalendarMonth;
  reminders: FinanceSettings;
  /** Every open bill, whenever due, except recurring ones due after the current month. */
  outstanding: AmountCount;
  overdue: AmountCount;
  /** Of the kinds the reminders cover. */
  dueSoon: AmountCount;
  current: PeriodTotals;
  change: Record<'scheduled' | 'paid', Change>;
  trend: Array<MonthlyFigures>;
  commitments: Array<CommitmentFigures>;
  categories: Array<CategoryFigures>;
  installments: Record<'activePlans' | 'openInstallments', number> &
    Record<'outstanding', DecimalString>;
  recurring: Record<'activeSeries', number> &
    Record<'monthlyEquivalent', DecimalString> &
    Record<'series', Array<RecurringExpense>>;
  upcoming: Array<Expense>;
};

export type FinanceCalendarParams = ReferenceDayParams &
  Record<'month', CalendarMonth> &
  Partial<Record<'currency', string>>;

export type GetFinanceCalendarResponseData = Record<'month', CalendarMonth> &
  Record<'days', Array<CalendarDayFigures>>;

export type FinanceReportParams = ReferenceDayParams &
  Record<'from' | 'to', CalendarMonth> &
  Partial<Record<'currency', string>>;

export type GetFinanceReportResponseData = {
  currency: string;
  currencies: Array<string>;
  from: CalendarMonth;
  to: CalendarMonth;
  totals: PeriodTotals;
  previous: Record<'from' | 'to', CalendarMonth> &
    Record<'scheduled' | 'paid', DecimalString>;
  change: Record<'scheduled' | 'paid', Change>;
  months: Array<MonthlyFigures>;
  categories: Array<CategoryFigures>;
  kinds: Array<KindFigures>;
};

export type GetFinanceAlertsResponseData = Record<
  'reminders',
  FinanceSettings
> &
  Record<'overdue' | 'dueSoon', AlertGroup>;

export type GetFinanceSettingsResponseData = FinanceSettings;

export type UpdateFinanceSettingsRequestPayload = FinanceSettings;

export type UpdateFinanceSettingsResponseData = WithMessage &
  Record<'settings', FinanceSettings>;
