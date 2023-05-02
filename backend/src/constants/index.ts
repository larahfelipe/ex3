import type { TransactionType } from '@/domain/models';

export const DefaultErrorMessages = {
  BAD_REQUEST: 'Invalid or corrupted request',
  FORBIDDEN: 'Resource access denied',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Authentication required',
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred',
  INVALID_AUTH_HEADER: 'Invalid authorization header',
  INVALID_TOKEN: 'Invalid access token'
};

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
    'Invalid transaction, cannot sell more assets than you have',
  CREATED: 'Transaction created successfully',
  UPDATED: 'Transaction updated successfully',
  DELETED: 'Transaction deleted successfully'
};

export const UserMessages = {
  NOT_FOUND: 'User not found',
  ALREADY_EXISTS: 'User already exists',
  INVALID_PASSWORD: 'Invalid password',
  CREATED: 'User created successfully',
  UPDATED: 'User updated successfully',
  DELETED: 'User deleted successfully'
};

export const TransactionTypes: Record<TransactionType, TransactionType> = {
  BUY: 'BUY',
  SELL: 'SELL'
};
