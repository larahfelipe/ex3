import type { LocaleMessages, Messages } from '../catalog';

export default {
  title: 'Reports',
  period: '{kind, select, range {{from} to {to}} other {{from}}}',
  span: '{kind, select, range {from {from} to {to}} other {in {from}}}',
  comparedTo:
    '{kind, select, range {between {from} and {to}} other {in {from}}}',
  headerWithCurrency: '{period} · Amounts in {currency}',
  periodGroup: 'Report period',
  from: 'From',
  to: 'To',
  loading: 'Loading the report',
  loadFailed: "Couldn't load the report",
  empty: 'Nothing came due or was paid in {currency} {span}',
  metrics: {
    planned: 'Planned',
    paid: 'Paid',
    owed: 'Outstanding',
    owedDetail:
      '{count, plural, =0 {No bills} one {From # bill} other {From # bills}} due in the period',
    overdue: 'Overdue',
    nothingOverdue: 'Nothing overdue',
    overdueDetail:
      '{count, plural, one {# overdue bill} other {# overdue bills}}'
  },
  adjustments: 'The payments include {items}.',
  adjustmentFees: '{amount} in interest and late fees',
  adjustmentDiscounts: '{amount} in discounts',
  trend: {
    title: 'Planned and paid by month',
    description:
      "Planned adds up the bills due in each month; paid adds up the payments made in the month, whatever the bill's due date",
    planned: 'Planned',
    paid: 'Paid',
    link: 'Opens the bills due that month'
  },
  categories: {
    title: 'By category',
    description: 'Planned in the period and its share of the total',
    empty: 'Nothing planned in the period'
  },
  kinds: {
    title: 'By type',
    description: 'One-time bills, installment plans and recurring expenses'
  },
  paidDetail: 'Paid: {amount}',
  payments: {
    title: 'Payments',
    description: 'Every payment made {span}, newest first',
    loading: 'Loading the payments',
    loadFailed: "Couldn't load the payments",
    empty: 'No payments {span}',
    table: 'Payments table',
    columns: {
      bill: 'Bill',
      paidOn: 'Paid on',
      method: 'Payment method',
      amount: 'Amount'
    },
    pages: 'Payment pages',
    count:
      '{count, plural, =0 {No payments} one {# payment} other {# payments}}',
    fees: 'plus {amount} in interest and late fees',
    discount: 'minus {amount} in discount'
  }
} as const satisfies LocaleMessages<Messages['reports']>;
