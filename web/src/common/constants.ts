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
