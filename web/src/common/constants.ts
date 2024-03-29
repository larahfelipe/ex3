import { Inter, Raleway } from 'next/font/google';

export const inter = Inter({
  weight: ['400', '500', '700'],
  subsets: ['latin']
});

export const raleway = Raleway({
  weight: ['400', '500', '700'],
  subsets: ['latin']
});

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

export const TABLE_ACTIONS = {
  AddAsset: 'add-asset',
  AddTransaction: 'add-transaction',
  Edit: 'edit',
  Delete: 'delete'
} as const;
