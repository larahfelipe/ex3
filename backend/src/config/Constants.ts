import type { InstrumentType, TransactionType } from '@/domain/models';

export const Errors = {
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    status: 400,
    message: 'Invalid or corrupted request'
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: 403,
    message: 'Resource access denied'
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    message: 'Resource not found'
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    status: 401,
    message: 'Authentication required'
  },
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    status: 413,
    message: 'Request payload exceeds the maximum allowed size'
  },
  TOO_MANY_REQUESTS: {
    code: 'TOO_MANY_REQUESTS',
    status: 429,
    message: 'Too many requests, please try again later'
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    status: 500,
    message: 'An unexpected error occurred'
  }
};

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
  SELL: 'SELL'
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
