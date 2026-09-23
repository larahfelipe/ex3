import { type ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { Inter, Raleway } from 'next/font/google';

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

export const APP_TITLE_TEMPLATE = `${APP_TITLE} | %s`;

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
  'SELL',
  'DIVIDEND',
  'JCP',
  'INTEREST',
  'BONUS'
] as const;

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

export const ASSET_DIALOG_PARAMS = {
  Action: 'action',
  Symbol: 'symbol'
} as const;

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
    Overview: '/',
    Portfolios: '/portfolios'
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
