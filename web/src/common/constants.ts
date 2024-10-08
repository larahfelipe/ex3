import { type ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { Inter, Raleway } from 'next/font/google';

import type { TransactionType } from '@/app/api/v1/transactions';

export const inter = Inter({
  weight: ['400', '500', '700'],
  subsets: ['latin']
});

export const raleway = Raleway({
  weight: ['400', '500', '700'],
  subsets: ['latin']
});

export const COOKIE_OPTIONS: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production'
};

export const APP_STORAGE_KEYS = {
  User: 'ex3:user',
  Token: 'ex3:token'
};

export const CURRENCIES = {
  BRL: {
    id: 'BRL',
    symbol: 'R$',
    name: 'Real'
  },
  USD: {
    id: 'USD',
    symbol: '$',
    name: 'US Dollar'
  },
  EUR: {
    id: 'EUR',
    symbol: '€',
    name: 'Euro'
  }
} as const;

export const TRANSACTION_TYPES: Array<TransactionType> = [
  'BUY',
  'SELL'
] as const;

export const ASSET_DIALOG_ACTIONS = {
  Add: 'add-asset',
  AddTransaction: 'add-transaction',
  Edit: 'edit-asset',
  Delete: 'delete-asset'
} as const;
