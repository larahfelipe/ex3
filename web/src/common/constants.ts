import { type ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

import type {
  ExpenseCategory,
  ExpenseKind,
  ExpenseStatus,
  ExpenseStatusFilter,
  InstallmentPlanStatus,
  PaymentMethod,
  RecurrenceFrequency,
  RecurringExpenseStatus
} from '@/app/api/v1/finances';
import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { TransactionType } from '@/app/api/v1/transactions';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * A cookie is deleted only by a `Set-Cookie` that repeats these attributes:
 * browsers drop a `__Host-` cookie sent without `Secure`, the deletion too.
 */
export const COOKIE_OPTIONS: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  path: '/'
};

/**
 * A browser keeps a `__Host-` cookie only when this host set it over HTTPS for
 * every path, so no sibling subdomain or plain-HTTP response can plant or
 * overwrite the session. Development is served over plain HTTP, where neither
 * `Secure` nor the prefix can be set.
 */
const SESSION_COOKIE_PREFIX = isProduction ? '__Host-' : '';

export const APP_STORAGE_KEYS = {
  Token: `${SESSION_COOKIE_PREFIX}ex3:token`,
  Session: `${SESSION_COOKIE_PREFIX}ex3:session`,
  ActivePortfolio: 'ex3:active-portfolio',
  Navigation: 'ex3:navigation',
  Locale: 'ex3:locale',
  GettingStartedDismissed: 'ex3:getting-started-dismissed'
};

/**
 * Sent by the app with every request to its own API routes. Another origin can
 * add a custom header only after a CORS preflight, which these routes never
 * grant, so a write without it did not come from the app, even in a browser too
 * old to send `Sec-Fetch-Site`.
 */
export const CSRF_HEADER = { Name: 'x-ex3-csrf', Value: '1' } as const;

export const NONCE_HEADER = 'x-nonce';

export const BOT_CHALLENGE = {
  Header: 'x-bot-challenge',
  TokenMaxLength: 2048,
  Actions: { SignIn: 'sign-in', SignUp: 'sign-up' }
} as const;

export type BotChallengeAction =
  (typeof BOT_CHALLENGE.Actions)[keyof typeof BOT_CHALLENGE.Actions];

export const REQUEST_LIMITS = {
  JsonBodyBytes: 100 * 1024,
  UploadBodyBytes: 4 * 1024 * 1024
} as const;

export const TRANSACTION_IMPORT = {
  FileMaxBytes: 2 * 1024 * 1024,
  SelectedRowsMax: 5000,
  Extensions: ['.xlsx', '.csv'],
  RequestTimeoutMs: 90_000,
  ReplanDelayMs: 700,
  RowsPageSize: 50
} as const;

export const PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const NAVIGATION_STATES = {
  Expanded: 'expanded',
  Collapsed: 'collapsed'
} as const;

export const APP_TITLE = 'EX3';

export const APP_THEME = 'dark';

/** `--background` of the `APP_THEME` palette in hex, for the browser's own chrome, which reads no CSS token. */
export const APP_THEME_COLOR = '#0e0e0e';

export const APP_TITLE_TEMPLATE = `${APP_TITLE} | %s`;

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

export const TRANSACTION_TYPE_TONES: Record<TransactionType, string> = {
  BUY: 'text-positive',
  SELL: 'text-negative',
  DIVIDEND: 'text-info',
  JCP: 'text-info',
  INTEREST: 'text-info',
  BONUS: 'text-primary'
};

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
    AssetImport: '/assets/import',
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
  'SUBSCRIPTIONS',
  'FOOD',
  'TRANSPORTATION',
  'HEALTH',
  'EDUCATION',
  'LEISURE',
  'SHOPPING',
  'FINANCIAL',
  'OTHER'
];

/** Categories no bill has any more, which only the history of a change still names. */
export const RETIRED_EXPENSE_CATEGORIES = [
  'INSURANCE',
  'TAXES',
  'DEBT',
  'PERSONAL_CARE'
] as const;

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

export const RECURRENCE_FREQUENCIES: Array<RecurrenceFrequency> = [
  'MONTHLY',
  'WEEKLY',
  'YEARLY'
];

export const EXPENSE_STATUSES: Array<ExpenseStatus> = [
  'OVERDUE',
  'PENDING',
  'PAID',
  'CANCELLED'
];

export const EXPENSE_STATUS_FILTERS: Array<ExpenseStatusFilter> = [
  'OPEN',
  ...EXPENSE_STATUSES
];

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

export const INSTALLMENT_PLAN_STATUSES: Array<InstallmentPlanStatus> = [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
];

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

export const RECURRING_EXPENSE_STATUS_TONES: Record<
  RecurringExpenseStatus,
  string
> = {
  ACTIVE: 'border-primary/40 bg-primary/10 text-primary',
  ENDED: 'border-border bg-muted text-muted-foreground',
  CANCELLED: 'border-border bg-muted text-muted-foreground'
};

export const BILL_DETAIL_PARAM = 'expense';

export const billDetailRoute = (expenseId: string) =>
  `${APP_ROUTES.Protected.FinanceBills}?${new URLSearchParams({ [BILL_DETAIL_PARAM]: expenseId })}`;

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
