import type {
  ExpenseCategory,
  ExpenseKind,
  ExpenseStatus,
  ExpenseStatusFilter,
  InstallmentPlanStatus,
  InstrumentType,
  PaymentMethod,
  RecurrenceFrequency,
  RecurringExpenseStatus,
  TransactionType
} from '@/domain/models';

/**
 * The categories an API failure is classified into. The category name is the
 * `code` on the wire: stable across releases, so a client branches on it and a
 * log groups by it.
 */
export const ErrorCategories = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DOMAIN: 'DOMAIN',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  INTERNAL: 'INTERNAL'
} as const;

export type ErrorCategory =
  (typeof ErrorCategories)[keyof typeof ErrorCategories];

type ErrorDefinition = {
  code: ErrorCategory;
  status: number;
  message: string;
};

/**
 * Status and category are different axes, so two entries can share a category:
 * a payload past the limit is a validation failure answered with 413, and a
 * throttled caller is an infrastructure limit answered with 429.
 */
export const Errors = {
  VALIDATION: {
    code: ErrorCategories.VALIDATION,
    status: 400,
    message: 'Invalid or corrupted request'
  },
  AUTHENTICATION: {
    code: ErrorCategories.AUTHENTICATION,
    status: 401,
    message: 'Authentication required'
  },
  AUTHORIZATION: {
    code: ErrorCategories.AUTHORIZATION,
    status: 403,
    message: 'Resource access denied'
  },
  NOT_FOUND: {
    code: ErrorCategories.NOT_FOUND,
    status: 404,
    message: 'Resource not found'
  },
  CONFLICT: {
    code: ErrorCategories.CONFLICT,
    status: 409,
    message: 'Resource already exists'
  },
  PAYLOAD_TOO_LARGE: {
    code: ErrorCategories.VALIDATION,
    status: 413,
    message: 'Request payload exceeds the maximum allowed size'
  },
  DOMAIN: {
    code: ErrorCategories.DOMAIN,
    status: 422,
    message: 'Request breaks a rule of the domain'
  },
  THROTTLED: {
    code: ErrorCategories.INFRASTRUCTURE,
    status: 429,
    message: 'Too many requests, please try again later'
  },
  UNAVAILABLE: {
    code: ErrorCategories.INFRASTRUCTURE,
    status: 503,
    message: 'Service dependencies are unavailable'
  },
  INTERNAL: {
    code: ErrorCategories.INTERNAL,
    status: 500,
    message: 'An unexpected error occurred'
  }
} as const satisfies Record<string, ErrorDefinition>;

const ONE_MINUTE_IN_MS = 60_000;
const FIFTEEN_MINUTES_IN_MS = 15 * ONE_MINUTE_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;

/**
 * Assumed, not measured. Sign-in counts only failed attempts, in three layers:
 * per client address across accounts, against password spraying and
 * credential stuffing from one host; per account and address, the one a person
 * who forgot the password meets; and per account across addresses, against
 * guessing spread over many hosts, which is also what an attacker spends to
 * keep someone else's account locked. Each sign-up costs a bcrypt hash and a
 * transaction, so every attempt counts, per address. `ACCOUNT_CHANGE` holds
 * the routes that verify the password of a signed-in account to the budget of
 * a single address. `INSTRUMENT_SEARCH` bounds how fast one session can spend
 * the quote provider's request quota: a debounced search box asks a few times
 * per instrument typed, far below it.
 */
export const RateLimits = {
  SIGN_IN_PER_ADDRESS: { windowMs: FIFTEEN_MINUTES_IN_MS, limit: 50 },
  SIGN_IN_PER_ACCOUNT_AND_ADDRESS: {
    windowMs: FIFTEEN_MINUTES_IN_MS,
    limit: 10
  },
  SIGN_IN_PER_ACCOUNT: { windowMs: ONE_HOUR_IN_MS, limit: 50 },
  SIGN_UP_PER_ADDRESS: { windowMs: ONE_HOUR_IN_MS, limit: 10 },
  ACCOUNT_CHANGE: { windowMs: FIFTEEN_MINUTES_IN_MS, limit: 10 },
  API: { windowMs: ONE_MINUTE_IN_MS, limit: 120 },
  INSTRUMENT_SEARCH: { windowMs: ONE_MINUTE_IN_MS, limit: 30 }
} as const;

/**
 * What the web adds to each request it forwards: the address of the client it
 * serves, and the secret without which the API ignores that address.
 */
export const ProxyHeaders = {
  CLIENT_ADDRESS: 'x-client-address',
  PROXY_SECRET: 'x-api-proxy-secret'
} as const;

export const RequestLimits = {
  JSON_BODY_SIZE: '100kb'
} as const;

export const ProbeRoutes = {
  LIVENESS: '/health',
  READINESS: '/ready'
} as const;

export const AssetMessages = {
  NOT_FOUND: 'Asset not found in portfolio',
  ALREADY_EXISTS: 'Asset already exists in portfolio',
  EMPTY: 'No assets found for this portfolio',
  CREATED: 'Asset created successfully',
  UPDATED: 'Asset updated successfully',
  DELETED: 'Asset deleted successfully'
};

export const InstrumentMessages = {
  NOT_FOUND: 'Instrument not found in catalog',
  NOT_LISTED: 'Instrument not listed by the market data provider',
  ALREADY_EXISTS: 'Instrument already exists in catalog',
  PRIVATE_ALREADY_EXISTS:
    'Instrument already exists among your private instruments',
  CURRENCY_MISMATCH:
    'Invalid instrument: the currency must be the one its market quotes in',
  CREATED: 'Instrument created successfully',
  UPDATED: 'Instrument updated successfully'
};

export const MarketDataMessages = {
  UNAVAILABLE: 'Market data is unavailable, please try again later'
};

export const PortfolioMessages = {
  NOT_FOUND: 'Portfolio not found for this user',
  NAME_TAKEN: 'You already have a portfolio with this name',
  LAST_PORTFOLIO: 'The last portfolio of an account cannot be deleted',
  BASE_CURRENCY_LOCKED:
    'The base currency cannot change once the portfolio has transactions',
  CREATED: 'Portfolio created successfully',
  UPDATED: 'Portfolio updated successfully',
  DELETED: 'Portfolio deleted successfully'
};

export const TransactionMessages = {
  NOT_FOUND: 'Transaction not found for this asset',
  ACC_NEGATIVE_AMOUNT:
    'Invalid transaction: a sale would exceed the units held on its date',
  CURRENCY_MISMATCH:
    'Invalid transaction: every transaction of a position must share one currency',
  POSITION_OUT_OF_RANGE:
    'Invalid transaction: resulting position exceeds the supported range',
  CREATED: 'Transaction created successfully',
  UPDATED: 'Transaction updated successfully',
  DELETED: 'Transaction deleted successfully'
};

export const UserMessages = {
  ALREADY_EXISTS: 'User already exists',
  INVALID_PASSWORD: 'Invalid password',
  INVALID_CREDENTIALS: 'Invalid email or password',
  PASSWORD_DERIVED_FROM_EMAIL:
    'Password must not contain the part of the email before the @',
  SIGNED_OUT: 'Signed out successfully',
  CREATED: 'User created successfully',
  UPDATED: 'User updated successfully',
  DELETED: 'User deleted successfully'
};

export const TransactionTypes: Record<TransactionType, TransactionType> = {
  BUY: 'BUY',
  SELL: 'SELL',
  DIVIDEND: 'DIVIDEND',
  JCP: 'JCP',
  INTEREST: 'INTEREST',
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  SPLIT: 'SPLIT',
  BONUS: 'BONUS',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  ADJUSTMENT: 'ADJUSTMENT'
} as const;

/**
 * The types whose effect on a position the ledger replay implements. The API
 * records no other type, because no position could be rebuilt from it.
 */
export const RecordableTransactionTypes = {
  BUY: 'BUY',
  SELL: 'SELL',
  DIVIDEND: 'DIVIDEND',
  JCP: 'JCP',
  INTEREST: 'INTEREST',
  BONUS: 'BONUS'
} as const satisfies Partial<Record<TransactionType, TransactionType>>;

export const IncomeTransactionTypes = {
  DIVIDEND: 'DIVIDEND',
  JCP: 'JCP',
  INTEREST: 'INTEREST'
} as const satisfies Partial<Record<TransactionType, TransactionType>>;

/**
 * Mirrors `@db.Decimal(38, 18)`, the type of every quantity and monetary column
 * in `schema.prisma`. Input limits and the range a rebuilt position must fit
 * derive from it.
 */
export const DecimalColumn = {
  PRECISION: 38,
  SCALE: 18
} as const;

export const InstrumentTypes: Record<InstrumentType, InstrumentType> = {
  STOCK: 'STOCK',
  ETF: 'ETF',
  FUND: 'FUND',
  REIT: 'REIT',
  CRYPTO: 'CRYPTO',
  BOND: 'BOND',
  TREASURY: 'TREASURY',
  CASH: 'CASH',
  OTHER: 'OTHER'
} as const;

/**
 * The markets an instrument can be registered in: the ones the quote provider
 * knows how to price, so every instrument registered from now on has a quote.
 */
export const Markets = {
  B3: 'B3',
  NYSE: 'NYSE',
  NASDAQ: 'NASDAQ',
  CRYPTO: 'CRYPTO'
} as const;

export type Market = (typeof Markets)[keyof typeof Markets];

/**
 * The currency the quote provider prices each market in, so an instrument
 * declared in another one would be valued in the wrong currency. Null where the
 * pair asked for names the currency, as in crypto.
 */
export const MarketQuoteCurrencies: Record<Market, string | null> = {
  B3: 'BRL',
  NYSE: 'USD',
  NASDAQ: 'USD',
  CRYPTO: null
};

/**
 * The currencies a crypto symbol is looked up in when searching the quote
 * provider, since the pair names the currency: the ones the web offers as a
 * portfolio base currency.
 */
export const CryptoListingCurrencies = ['BRL', 'USD', 'EUR'] as const;

/**
 * Bounds of what a client or the quote provider can store on an instrument
 * (OWASP API4:2023, unrestricted resource consumption). Assumed, not measured:
 * above the longest symbol, name and sector label an exchange listing
 * publishes.
 */
export const InstrumentLimits = {
  SYMBOL_MAX_LENGTH: 6,
  NAME_MAX_LENGTH: 120,
  SECTOR_MAX_LENGTH: 60
} as const;

/**
 * Listings number their pages from one and answer `DEFAULT_SIZE` rows when the
 * query names no size. `MAX_SIZE` bounds the rows one response can carry (OWASP
 * API4:2023, unrestricted resource consumption), above every page size the web
 * offers.
 */
export const Pagination = {
  FIRST_PAGE: 1,
  DEFAULT_SIZE: 10,
  MAX_SIZE: 100
} as const;

/**
 * Letters and digits only, so a symbol can neither change the path or query of
 * a provider URL nor carry a pattern wildcard into a search.
 */
export const INSTRUMENT_SYMBOL_PATTERN = /^[A-Z0-9]+$/;

/**
 * What became of the quote provider lookup of an instrument search: `SKIPPED`
 * when the term cannot be a symbol or names one the caller already sees.
 */
export const MarketSearchStatuses = {
  SEARCHED: 'SEARCHED',
  SKIPPED: 'SKIPPED',
  UNAVAILABLE: 'UNAVAILABLE'
} as const;

export type MarketSearchStatus =
  (typeof MarketSearchStatuses)[keyof typeof MarketSearchStatuses];

export const InstrumentScopes = {
  CATALOG: 'CATALOG',
  PRIVATE: 'PRIVATE'
} as const;

export type InstrumentScope =
  (typeof InstrumentScopes)[keyof typeof InstrumentScopes];

export const SortOrderTypes = {
  ASCENDENT: 'asc',
  DESCENDENT: 'desc'
} as const;

export const ExpenseCategories: Record<ExpenseCategory, ExpenseCategory> = {
  HOUSING: 'HOUSING',
  UTILITIES: 'UTILITIES',
  FOOD: 'FOOD',
  TRANSPORTATION: 'TRANSPORTATION',
  HEALTH: 'HEALTH',
  EDUCATION: 'EDUCATION',
  LEISURE: 'LEISURE',
  SUBSCRIPTIONS: 'SUBSCRIPTIONS',
  INSURANCE: 'INSURANCE',
  TAXES: 'TAXES',
  DEBT: 'DEBT',
  SHOPPING: 'SHOPPING',
  PERSONAL_CARE: 'PERSONAL_CARE',
  OTHER: 'OTHER'
} as const;

export const PaymentMethods: Record<PaymentMethod, PaymentMethod> = {
  CASH: 'CASH',
  DEBIT_CARD: 'DEBIT_CARD',
  CREDIT_CARD: 'CREDIT_CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  PIX: 'PIX',
  BOLETO: 'BOLETO',
  DIRECT_DEBIT: 'DIRECT_DEBIT',
  OTHER: 'OTHER'
} as const;

export const RecurrenceFrequencies: Record<
  RecurrenceFrequency,
  RecurrenceFrequency
> = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY'
} as const;

export const ExpenseStatuses: Record<ExpenseStatus, ExpenseStatus> = {
  PENDING: 'PENDING',
  OVERDUE: 'OVERDUE',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED'
} as const;

export const ExpenseStatusFilters: Record<
  ExpenseStatusFilter,
  ExpenseStatusFilter
> = { ...ExpenseStatuses, OPEN: 'OPEN' } as const;

export const ExpenseKinds: Record<ExpenseKind, ExpenseKind> = {
  ONE_TIME: 'ONE_TIME',
  INSTALLMENT: 'INSTALLMENT',
  RECURRING: 'RECURRING'
} as const;

export const InstallmentPlanStatuses: Record<
  InstallmentPlanStatus,
  InstallmentPlanStatus
> = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export const RecurringExpenseStatuses: Record<
  RecurringExpenseStatus,
  RecurringExpenseStatus
> = {
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED'
} as const;

export const ExpenseSortFields = {
  DUE_DATE: 'dueDate',
  AMOUNT: 'amount',
  DESCRIPTION: 'description',
  CREATED_AT: 'createdAt'
} as const;

/**
 * Bounds of what a client can store or ask for in personal finance (OWASP
 * API4:2023, unrestricted resource consumption). Assumed, not measured:
 * `INSTALLMENT_MAX_COUNT` covers a 30-year monthly financing;
 * `OCCURRENCE_HORIZON_MONTHS` is how far ahead a recurring expense's
 * occurrences exist, the window planning projects over; `REPORT_MAX_MONTHS`
 * bounds the rows a report reads; `REFERENCE_DAY_TOLERANCE_DAYS` is how far the
 * caller's calendar day may be from the server's UTC day, the span of the
 * world's time zones.
 */
export const FinanceLimits = {
  DESCRIPTION_MAX_LENGTH: 120,
  SUBCATEGORY_MAX_LENGTH: 60,
  ACCOUNT_MAX_LENGTH: 60,
  NOTES_MAX_LENGTH: 500,
  SEARCH_MAX_LENGTH: 120,
  INSTALLMENT_MAX_COUNT: 360,
  OCCURRENCE_HORIZON_MONTHS: 12,
  REPORT_MAX_MONTHS: 24,
  REMINDER_MAX_LEAD_DAYS: 30,
  REMINDER_DEFAULT_LEAD_DAYS: 3,
  UPCOMING_LIMIT: 5,
  SUMMARY_TREND_MONTHS: 6,
  SUMMARY_COMMITMENT_MONTHS: 6,
  ALERT_ITEMS_LIMIT: 10,
  REFERENCE_DAY_TOLERANCE_DAYS: 1
} as const;

export const FinanceMessages = {
  EXPENSE_NOT_FOUND: 'Expense not found',
  PAYMENT_NOT_FOUND: 'Payment not found for this expense',
  INSTALLMENT_PLAN_NOT_FOUND: 'Installment plan not found',
  RECURRING_EXPENSE_NOT_FOUND: 'Recurring expense not found',
  AMOUNT_PRECISION:
    'Amount has more decimal places than the currency has minor units',
  AMOUNT_BELOW_SETTLED:
    'The amount cannot be less than what the payments already settled',
  PAYMENT_EXCEEDS_OUTSTANDING:
    'The payment settles more than the expense still owes',
  ALREADY_SETTLED: 'The expense is already paid in full',
  EXPENSE_CANCELLED: 'The expense is cancelled',
  EXPENSE_HAS_PAYMENTS:
    'An expense with payments cannot be cancelled or deleted; void its payments first',
  EXPENSE_MANAGED_BY_ORIGIN:
    'Installments and recurring occurrences are deleted through their plan or series; cancel this one instead',
  EXPENSE_ORIGIN_CANCELLED:
    'The plan or series this expense belongs to is cancelled',
  PLAN_HAS_PAYMENTS:
    'A plan with payments cannot be deleted; cancel it to keep its history',
  PLAN_CANCELLED: 'The installment plan is cancelled',
  RESCHEDULE_BEFORE_KEPT:
    'The next due date cannot be before the due date of the last installment with payments',
  PAYMENT_EMPTY: 'A payment must settle an amount or a discount above zero',
  PAYMENT_IN_FUTURE: 'Payment date cannot be in the future',
  END_BEFORE_START: 'End date must not be before the start date',
  INSTALLMENT_SPLIT_TOO_SMALL:
    'The amount is too small to split into that many installments',
  SERIES_HAS_PAYMENTS:
    'A recurring expense with payments cannot be deleted; cancel it to keep its history',
  SERIES_CANCELLED: 'The recurring expense is cancelled',
  END_BEFORE_PAID_OCCURRENCE:
    'The end date would remove an occurrence that already has payments',
  EFFECTIVE_FROM_AFTER_HORIZON: `Effective from cannot be later than the day after the ${FinanceLimits.OCCURRENCE_HORIZON_MONTHS} months bills are created ahead`,
  REFERENCE_DAY_OUT_OF_RANGE:
    'The reference day must be within one day of the current date',
  EXPENSE_CREATED: 'Expense created successfully',
  EXPENSE_UPDATED: 'Expense updated successfully',
  EXPENSE_DELETED: 'Expense deleted successfully',
  PAYMENT_RECORDED: 'Payment recorded successfully',
  PAYMENT_UPDATED: 'Payment corrected successfully',
  PAYMENT_VOIDED: 'Payment voided successfully',
  PLAN_CREATED: 'Installment plan created successfully',
  PLAN_UPDATED: 'Installment plan updated successfully',
  PLAN_RESCHEDULED: 'Installment plan rescheduled successfully',
  PLAN_CANCELLED_SUCCESSFULLY: 'Installment plan cancelled successfully',
  PLAN_DELETED: 'Installment plan deleted successfully',
  SERIES_CREATED: 'Recurring expense created successfully',
  SERIES_UPDATED: 'Recurring expense updated successfully',
  SERIES_CANCELLED_SUCCESSFULLY: 'Recurring expense cancelled successfully',
  SERIES_DELETED: 'Recurring expense deleted successfully',
  SETTINGS_UPDATED: 'Finance settings updated successfully'
};

/** What a finance aggregate is computed in when the query names no currency: the web's default. */
export const DEFAULT_FINANCE_CURRENCY = 'BRL';
