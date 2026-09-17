import { type ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { Inter, Raleway } from 'next/font/google';

import type { InstrumentType } from '@/app/api/v1/portfolio';
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

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUY: 'Buy',
  SELL: 'Sell'
};

export const TRANSACTION_TYPE_TONES: Record<TransactionType, string> = {
  BUY: 'text-green-600',
  SELL: 'text-red-600'
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

export const ASSET_DIALOG_ACTIONS = {
  Add: 'add-asset',
  AddTransaction: 'add-transaction',
  Delete: 'delete-asset'
} as const;

export const APP_ROUTES = {
  Public: {
    SignIn: '/sign-in',
    SignUp: '/sign-up'
  },
  Protected: {
    Account: '/account',
    Assets: '/assets',
    Overview: '/'
  }
} as const;

export const assetDetailRoute = (symbol: string) =>
  `${APP_ROUTES.Protected.Assets}/${encodeURIComponent(symbol)}`;
