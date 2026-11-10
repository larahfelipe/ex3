import type { LocaleMessages, Messages } from '../catalog';

export default {
  description:
    'The active portfolio is the one the overview and the assets show',
  newPortfolio: 'New portfolio',
  listTitle: 'Your portfolios',
  loadFailed: "Couldn't load your portfolios",
  loading: 'Loading your portfolios',
  emptyTitle: 'No portfolios yet',
  empty:
    'Create one to add assets, record transactions and follow its value in its own currency.',
  createFirst: 'Create a portfolio',
  emptyPage: 'No portfolios on page {page, number}',
  goToPage: 'Go to page {page, number}',
  active: 'Active',
  baseCurrency: 'Base currency {currency}',
  use: 'Use',
  useNamed: 'Use {name}',
  editNamed: 'Edit {name}',
  deleteNamed: 'Delete {name}',
  soleNote:
    "An account keeps at least one portfolio, so the only one can't be deleted.",
  pages: 'Portfolio pages',
  activated: '{name} is now the active portfolio',
  storageBlocked:
    'Your browser blocked saving the active portfolio. Allow site data for this app and try again.',
  deletion: {
    title: 'Delete {name}?',
    description:
      'Every asset and transaction in {name} is deleted along with it.',
    permanent: "This is permanent and can't be undone.",
    activeFallback: 'Afterwards, the app shows your oldest portfolio.',
    confirm: 'Delete portfolio',
    failed: "Couldn't delete the portfolio"
  },
  form: {
    editTitle: 'Edit {name}',
    newTitle: 'New portfolio',
    description:
      "A portfolio's positions and transactions are valued in its base currency.",
    name: 'Name',
    baseCurrency: 'Base currency',
    baseCurrencyLockedHint:
      'The base currency can change only while the portfolio has no transactions.',
    create: 'Create portfolio'
  },
  totalValue: {
    label: 'Total value',
    loadFailed: "Couldn't load",
    retry: 'Try loading the value of {name} again',
    noHoldings: 'No positions',
    marketDataUnavailable: 'Quotes unavailable'
  },
  notifications: {
    created: 'Portfolio created',
    updated: 'Portfolio updated',
    deleted: 'Portfolio deleted'
  }
} as const satisfies LocaleMessages<Messages['portfolios']>;
