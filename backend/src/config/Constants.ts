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

/**
 * `INSTRUMENT_SEARCH` bounds how fast one session can spend the quote
 * provider's request quota. Assumed, not measured: a debounced search box asks
 * a few times per instrument typed, far below it.
 */
export const RateLimits = {
  AUTH: { windowMs: 15 * ONE_MINUTE_IN_MS, limit: 10 },
  API: { windowMs: ONE_MINUTE_IN_MS, limit: 120 },
  INSTRUMENT_SEARCH: { windowMs: ONE_MINUTE_IN_MS, limit: 30 }
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

/** Whether an instrument belongs to the shared catalog or to the caller alone. */
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
