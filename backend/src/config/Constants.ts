import type { InstrumentType, TransactionType } from '@/domain/models';

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

export const RateLimits = {
  AUTH: { windowMs: 15 * ONE_MINUTE_IN_MS, limit: 10 },
  API: { windowMs: ONE_MINUTE_IN_MS, limit: 120 }
} as const;

export const RequestLimits = {
  JSON_BODY_SIZE: '100kb'
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
  ALREADY_EXISTS: 'Instrument already exists in catalog',
  CREATED: 'Instrument created successfully',
  UPDATED: 'Instrument updated successfully'
};

export const PortfolioMessages = {
  NOT_FOUND: 'Portfolio not found for this user',
  CREATED: 'Portfolio created successfully'
};

export const TransactionMessages = {
  NOT_FOUND: 'Transaction not found for this asset',
  ACC_NEGATIVE_AMOUNT:
    'Invalid transaction: resulting amount cannot be negative',
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

export const SortOrderTypes = {
  ASCENDENT: 'asc',
  DESCENDENT: 'desc'
} as const;
