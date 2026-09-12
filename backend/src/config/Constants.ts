import type { TransactionType } from '@/domain/models';

export const Errors = {
  BAD_REQUEST: {
    name: 'BadRequestError',
    status: 400,
    message: 'Invalid or corrupted request'
  },
  FORBIDDEN: {
    name: 'ForbiddenError',
    status: 403,
    message: 'Resource access denied'
  },
  NOT_FOUND: {
    name: 'NotFoundError',
    status: 404,
    message: 'Resource not found'
  },
  UNAUTHORIZED: {
    name: 'UnauthorizedError',
    status: 401,
    message: 'Authentication required'
  },
  TOO_MANY_REQUESTS: {
    name: 'TooManyRequestsError',
    status: 429,
    message: 'Too many requests, please try again later'
  },
  INTERNAL_SERVER_ERROR: {
    name: 'InternalServerError',
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

export const PortfolioMessages = {
  NOT_FOUND: 'Portfolio not found for this user'
};

export const TransactionMessages = {
  NOT_FOUND: 'Transaction not found for this asset',
  ACC_NEGATIVE_AMOUNT:
    'Invalid transaction: resulting amount cannot be negative',
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
  SELL: 'SELL'
} as const;

export const SortOrderTypes = {
  ASCENDENT: 'asc',
  DESCENDENT: 'desc'
} as const;
