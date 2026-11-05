import type { LocaleMessages, Messages } from '../catalog';

export default {
  appDescription: 'EX3: investments and personal finances',
  skipToContent: 'Skip to content',
  main: 'Main navigation',
  brand: '{title}, overview',
  overview: 'Overview',
  assets: 'Assets',
  portfolios: 'Portfolios',
  finances: 'Finances',
  account: 'My account',
  signOut: 'Sign out',
  collapse: 'Collapse navigation',
  expand: 'Expand navigation',
  overdueCount:
    '{count, plural, one {, # overdue bill} other {, # overdue bills}}',
  pages: {
    overview: 'Overview',
    assets: 'Assets',
    assetImport: 'Import transactions',
    portfolios: 'Portfolios',
    account: 'My account',
    finances: 'Finances',
    bills: 'Bills',
    installments: 'Installment plans',
    recurring: 'Recurring expenses',
    calendar: 'Bill calendar',
    reports: 'Financial reports',
    signIn: 'Sign in',
    signUp: 'Create account',
    notFound: 'Page not found'
  }
} as const satisfies LocaleMessages<Messages['navigation']>;
