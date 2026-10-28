import { type ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { Inter, Raleway } from 'next/font/google';

import type {
  ExpenseCategory,
  ExpenseKind,
  ExpenseStatus,
  ExpenseStatusFilter,
  FinanceEventType,
  InstallmentPlanStatus,
  PaymentMethod,
  RecurrenceFrequency,
  RecurringExpenseStatus
} from '@/app/api/v1/finances';
import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { TransactionType } from '@/app/api/v1/transactions';

export const inter = Inter({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-inter'
});

export const raleway = Raleway({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-raleway'
});

export const COOKIE_OPTIONS: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production'
};

export const APP_STORAGE_KEYS = {
  Token: 'ex3:token',
  Session: 'ex3:session',
  ActivePortfolio: 'ex3:active-portfolio',
  Navigation: 'ex3:navigation'
};

export const NAVIGATION_STATES = {
  Expanded: 'expanded',
  Collapsed: 'collapsed'
} as const;

export const APP_TITLE = 'EX3';

/** The class on `<html>` that selects the theme's tokens, and the theme the toasts draw their own parts in. */
export const APP_THEME = 'dark';

/** `--background` of the `APP_THEME` palette in hex, for the browser's own chrome, which reads no CSS token. */
export const APP_THEME_COLOR = '#0e0e0e';

export const APP_TITLE_TEMPLATE = `${APP_TITLE} | %s`;

/** The base currencies a new portfolio is offered in; the API accepts any ISO 4217 code. */
export const OFFERED_CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

export const DEFAULT_CURRENCY =
  'BRL' satisfies (typeof OFFERED_CURRENCIES)[number];

export const TRANSACTION_TYPES: Array<TransactionType> = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'JCP',
  'INTEREST',
  'BONUS'
];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUY: 'Buy',
  SELL: 'Sell',
  DIVIDEND: 'Dividend',
  JCP: 'JCP',
  INTEREST: 'Interest',
  BONUS: 'Bonus'
};

export const TRANSACTION_TYPE_TONES: Record<TransactionType, string> = {
  BUY: 'text-positive',
  SELL: 'text-negative',
  DIVIDEND: 'text-info',
  JCP: 'text-info',
  INTEREST: 'text-info',
  BONUS: 'text-primary'
};

export const TRANSACTION_UNIT_PRICE_LABELS: Record<TransactionType, string> = {
  BUY: 'Unit price',
  SELL: 'Unit price',
  DIVIDEND: 'Amount per unit',
  JCP: 'Amount per unit',
  INTEREST: 'Amount per unit',
  BONUS: 'Attributed cost per unit'
};

export const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  STOCK: 'Stocks',
  ETF: 'ETFs',
  FUND: 'Funds',
  REIT: 'REITs',
  CRYPTO: 'Crypto',
  BOND: 'Bonds',
  TREASURY: 'Treasuries',
  CASH: 'Cash',
  OTHER: 'Other'
};

/**
 * Decimal places a unit price is typed with when the class is quoted finer
 * than the currency's minor unit. Assumed from market practice, not measured:
 * crypto units and fund shares are quoted to 8 places. The API stores 18 for
 * every class, so a price written with more places keeps them.
 */
export const UNIT_PRICE_DECIMALS: Partial<Record<InstrumentType, number>> = {
  CRYPTO: 8,
  FUND: 8
};

export const INSTRUMENT_TYPES: Array<InstrumentType> = [
  'STOCK',
  'ETF',
  'FUND',
  'REIT',
  'CRYPTO',
  'BOND',
  'TREASURY',
  'CASH',
  'OTHER'
];

export const APP_ROUTES = {
  Public: {
    SignIn: '/sign-in',
    SignUp: '/sign-up'
  },
  Protected: {
    Account: '/account',
    Assets: '/assets',
    Overview: '/',
    Portfolios: '/portfolios',
    Finances: '/finances',
    FinanceBills: '/finances/bills',
    FinanceInstallments: '/finances/installments',
    FinanceRecurring: '/finances/recurring',
    FinanceCalendar: '/finances/calendar',
    FinanceReports: '/finances/reports'
  }
} as const;

export const SIGN_IN_PARAMS = {
  Reason: 'reason',
  ReturnPath: 'next'
} as const;

export const SIGN_IN_REASONS = {
  SessionExpired: 'session-expired'
} as const;

export const signInRouteFor = ({
  returnPath,
  hasSessionExpired
}: {
  returnPath: string;
  hasSessionExpired: boolean;
}) => {
  const params = new URLSearchParams();

  if (hasSessionExpired)
    params.set(SIGN_IN_PARAMS.Reason, SIGN_IN_REASONS.SessionExpired);
  if (returnPath !== APP_ROUTES.Protected.Overview)
    params.set(SIGN_IN_PARAMS.ReturnPath, returnPath);

  return params.size
    ? `${APP_ROUTES.Public.SignIn}?${params}`
    : APP_ROUTES.Public.SignIn;
};

export const assetDetailRoute = (symbol: string) =>
  `${APP_ROUTES.Protected.Assets}/${encodeURIComponent(symbol)}`;

export const EXPENSE_CATEGORIES: Array<ExpenseCategory> = [
  'HOUSING',
  'UTILITIES',
  'FOOD',
  'TRANSPORTATION',
  'HEALTH',
  'EDUCATION',
  'LEISURE',
  'SUBSCRIPTIONS',
  'INSURANCE',
  'TAXES',
  'DEBT',
  'SHOPPING',
  'PERSONAL_CARE',
  'OTHER'
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  HOUSING: 'Housing',
  UTILITIES: 'Utilities',
  FOOD: 'Food',
  TRANSPORTATION: 'Transportation',
  HEALTH: 'Health',
  EDUCATION: 'Education',
  LEISURE: 'Leisure',
  SUBSCRIPTIONS: 'Subscriptions',
  INSURANCE: 'Insurance',
  TAXES: 'Taxes',
  DEBT: 'Debt',
  SHOPPING: 'Shopping',
  PERSONAL_CARE: 'Personal care',
  OTHER: 'Other'
};

export const PAYMENT_METHODS: Array<PaymentMethod> = [
  'PIX',
  'BOLETO',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'DIRECT_DEBIT',
  'CASH',
  'OTHER'
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  DEBIT_CARD: 'Debit card',
  CREDIT_CARD: 'Credit card',
  BANK_TRANSFER: 'Bank transfer',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  DIRECT_DEBIT: 'Direct debit',
  OTHER: 'Other'
};

export const RECURRENCE_FREQUENCIES: Array<RecurrenceFrequency> = [
  'MONTHLY',
  'WEEKLY',
  'YEARLY'
];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> =
  {
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
    YEARLY: 'Yearly'
  };

export const RECURRENCE_FREQUENCY_UNITS: Record<RecurrenceFrequency, string> = {
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year'
};

export const EXPENSE_STATUSES: Array<ExpenseStatus> = [
  'OVERDUE',
  'PENDING',
  'PAID',
  'CANCELLED'
];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
  CANCELLED: 'Cancelled'
};

export const EXPENSE_STATUS_FILTERS: Array<ExpenseStatusFilter> = [
  'OPEN',
  ...EXPENSE_STATUSES
];

export const EXPENSE_STATUS_FILTER_LABELS: Record<ExpenseStatusFilter, string> =
  { OPEN: 'Unpaid', ...EXPENSE_STATUS_LABELS };

/** A status is never told by its color alone: each tone sits beside the status's name. */
export const EXPENSE_STATUS_TONES: Record<ExpenseStatus, string> = {
  PENDING: 'border-warning/40 bg-warning/10 text-warning',
  OVERDUE: 'border-negative/40 bg-negative/10 text-negative',
  PAID: 'border-positive/40 bg-positive/10 text-positive',
  CANCELLED: 'border-border bg-muted text-muted-foreground'
};

export const EXPENSE_KINDS: Array<ExpenseKind> = [
  'ONE_TIME',
  'INSTALLMENT',
  'RECURRING'
];

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  ONE_TIME: 'One-time',
  INSTALLMENT: 'Installment',
  RECURRING: 'Recurring'
};

export const INSTALLMENT_PLAN_STATUSES: Array<InstallmentPlanStatus> = [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
];

export const INSTALLMENT_PLAN_STATUS_LABELS: Record<
  InstallmentPlanStatus,
  string
> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const INSTALLMENT_PLAN_STATUS_TONES: Record<
  InstallmentPlanStatus,
  string
> = {
  ACTIVE: 'border-primary/40 bg-primary/10 text-primary',
  COMPLETED: 'border-positive/40 bg-positive/10 text-positive',
  CANCELLED: 'border-border bg-muted text-muted-foreground'
};

export const RECURRING_EXPENSE_STATUSES: Array<RecurringExpenseStatus> = [
  'ACTIVE',
  'ENDED',
  'CANCELLED'
];

export const RECURRING_EXPENSE_STATUS_LABELS: Record<
  RecurringExpenseStatus,
  string
> = {
  ACTIVE: 'Active',
  ENDED: 'Ended',
  CANCELLED: 'Stopped'
};

export const RECURRING_EXPENSE_STATUS_TONES: Record<
  RecurringExpenseStatus,
  string
> = {
  ACTIVE: 'border-primary/40 bg-primary/10 text-primary',
  ENDED: 'border-border bg-muted text-muted-foreground',
  CANCELLED: 'border-border bg-muted text-muted-foreground'
};

export const FINANCE_EVENT_LABELS: Record<FinanceEventType, string> = {
  CREATED: 'Created',
  UPDATED: 'Edited',
  CANCELLED: 'Cancelled',
  RESTORED: 'Restored',
  PAYMENT_RECORDED: 'Payment recorded',
  PAYMENT_CORRECTED: 'Payment corrected',
  PAYMENT_VOIDED: 'Payment voided',
  RESCHEDULED: 'Rescheduled'
};

/** The query parameter that opens a bill's details on the bills page. */
export const BILL_DETAIL_PARAM = 'expense';

export const billDetailRoute = (expenseId: string) =>
  `${APP_ROUTES.Protected.FinanceBills}?${new URLSearchParams({ [BILL_DETAIL_PARAM]: expenseId })}`;

/** The query parameters that open a plan's or a series' details on its page. */
export const INSTALLMENT_PLAN_DETAIL_PARAM = 'plan';
export const RECURRING_EXPENSE_DETAIL_PARAM = 'series';

export const installmentPlanRoute = (planId: string) =>
  `${APP_ROUTES.Protected.FinanceInstallments}?${new URLSearchParams({ [INSTALLMENT_PLAN_DETAIL_PARAM]: planId })}`;

export const recurringExpenseRoute = (seriesId: string) =>
  `${APP_ROUTES.Protected.FinanceRecurring}?${new URLSearchParams({ [RECURRING_EXPENSE_DETAIL_PARAM]: seriesId })}`;

export const billsRouteFor = (filters: Record<string, string>) => {
  const params = new URLSearchParams(filters);

  return params.size
    ? `${APP_ROUTES.Protected.FinanceBills}?${params}`
    : APP_ROUTES.Protected.FinanceBills;
};

/** Mirror of the API's `FinanceLimits`, so a form refuses what the API would. */
export const FINANCE_LIMITS = {
  DescriptionMaxLength: 120,
  SubcategoryMaxLength: 60,
  AccountMaxLength: 60,
  NotesMaxLength: 500,
  SearchMaxLength: 120,
  InstallmentMaxCount: 360,
  OccurrenceHorizonMonths: 12,
  ReportMaxMonths: 24,
  ReminderMaxLeadDays: 30
} as const;
