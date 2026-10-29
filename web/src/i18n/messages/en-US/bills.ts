import type { LocaleMessages, Messages } from '../catalog';

export default {
  title: 'Bills',
  description:
    'Everything you owe, paid or cancelled: one-time bills, installments and recurring expenses',
  add: 'Add bill',
  allBills: 'All bills',
  filter: 'Filter bills',
  search: 'Search',
  searchPlaceholder: 'Search by description, notes or bank account',
  loading: 'Loading bills',
  loadFailed: "Couldn't load the bills",
  empty:
    'No bills yet. Add a one-time bill here; installment plans and recurring expenses generate their own bills.',
  noResults: 'No bill matches the search and filters',
  emptyPage: 'No bills on page {page, number}',
  goToPage: 'Go to page {page, number}',
  table: 'Bills table',
  caption:
    'Bills sorted by {field}, in {order, select, asc {ascending} other {descending}} order',
  columns: {
    bill: 'Bill',
    due: 'Due date',
    amount: 'Amount',
    status: 'Status',
    actions: 'Actions'
  },
  pages: 'Bill pages',
  count: '{total, plural, =0 {No bills} one {# bill} other {# bills}}',
  range:
    '{first, number}–{last, number} of {total, plural, one {# bill} other {# bills}}',
  dueOn: 'Due on <day></day>',
  meta: '{origin} · {category}',
  outstanding: '{amount} outstanding',
  pay: 'Pay',
  payBill: 'Pay {description}',
  sort: {
    label: 'Sort bills',
    by: 'Sort by',
    descending: 'Descending order',
    fields: {
      dueDate: 'Due date',
      amount: 'Amount',
      description: 'Description',
      createdAt: 'Date added'
    }
  },
  filters: {
    status: 'Status',
    allStatuses: 'All statuses',
    more: 'More filters',
    activeCount:
      '{count, number}<hidden> {count, plural, one {active} other {active}}</hidden>',
    kind: 'Type',
    allKinds: 'All types',
    category: 'Category',
    allCategories: 'All categories',
    dueFrom: 'Due from',
    dueTo: 'Due until',
    minAmount: 'Minimum amount',
    maxAmount: 'Maximum amount',
    anyAmount: 'Any',
    amountInvalid: 'Enter an amount such as 150 or 150.50',
    clearDay: 'Clear: {label}',
    inForce: 'Filters applied',
    remove: ', remove this filter',
    chips: {
      status: 'Status: {value}',
      kind: 'Type: {value}',
      category: 'Category: {value}',
      currency: '{currency} only',
      dueFrom: 'Due from {day}',
      dueTo: 'Due until {day}',
      minAmount: 'From {amount}',
      maxAmount: 'Up to {amount}'
    }
  },
  form: {
    addTitle: 'Add bill',
    editTitle: 'Edit bill',
    addDescription: 'A bill stays outstanding until you record its payment.',
    editDescription: 'Amounts in {currency}.',
    amountSection: 'Amount and due date',
    amount: 'Amount',
    dueDate: 'Due date',
    submitAdd: 'Add bill',
    failed: "Couldn't save the bill",
    originHints: {
      INSTALLMENT:
        'Changes apply to this installment only. To change what is left of the plan, reschedule it on the installment plans page.',
      RECURRING:
        "Changes apply to this occurrence only, and later edits to the recurring expense don't affect it."
    }
  },
  paymentForm: {
    payTitle: 'Pay {description}',
    correctTitle: 'Correct payment of {description}',
    description:
      '{outstanding} outstanding of {amount}. A partial payment leaves the rest outstanding.',
    section: 'Payment',
    amount: 'Amount paid',
    paidOn: 'Payment date',
    paidOnHint: 'The day the money went out, today at the latest',
    discount: 'Discount',
    discountHint: 'Settles part of the bill without being paid',
    fees: 'Interest and late fees',
    feesHint: 'Paid on top: they never settle the bill',
    detailsSection: 'Details',
    method: 'Payment method',
    notes: 'Notes',
    settlesInFull: 'Settles the whole bill',
    leaves: 'Leaves {amount} outstanding',
    settlesMore: 'Settles more than the bill still owes',
    submitRecord: 'Record payment',
    submitCorrect: 'Save correction',
    failed: "Couldn't save the payment",
    issues: {
      empty: 'Enter the amount paid, a discount or both',
      exceeds:
        'The amount paid and the discount settle more than the bill still owes',
      future: "The payment date can't be in the future"
    }
  },
  details: {
    title: 'Bill',
    loadFailed: "Couldn't load this bill",
    loading: 'Loading the bill',
    viewPlan: 'View installment plan',
    viewSeries: 'View recurring expense',
    amount: 'Amount',
    outstanding: 'Outstanding',
    settled: 'Settled',
    dueDate: 'Due date',
    paidInFullOn: 'Paid in full on',
    category: 'Category',
    paymentMethod: 'Payment method',
    account: 'Bank account or card',
    notes: 'Notes',
    payments: 'Payments',
    noPayments: 'No payments recorded yet',
    history: 'History',
    cancel: 'Cancel bill',
    restore: 'Restore bill',
    restoreFailed: "Couldn't restore the bill",
    recordPayment: 'Record payment'
  },
  payment: {
    paidOn: '<money></money><muted> on <day></day></muted>',
    voided: 'Voided',
    discount: 'Discount of {amount}',
    fees: 'Interest and late fees of {amount}',
    noDetails: 'No details',
    correct: 'Correct<hidden> the payment of {day}</hidden>',
    void: 'Void<hidden> the payment of {day}</hidden>'
  },
  voiding: {
    title: 'Void this payment?',
    description:
      '{amount} paid on {day}. The payment stays in the history as voided, and the bill owes again the amount it settled.',
    confirm: 'Void payment',
    failed: "Couldn't void the payment"
  },
  cancellation: {
    title: 'Cancel this bill?',
    description:
      '{description}, due on {day}. It no longer counts as owed and stays in the history; you can restore it later.',
    confirm: 'Cancel bill',
    failed: "Couldn't cancel the bill"
  },
  deletion: {
    title: 'Delete this bill?',
    description:
      "{description}, due on {day}. It is removed along with its history, and this can't be undone. To keep the record, cancel it instead.",
    confirm: 'Delete bill',
    failed: "Couldn't delete the bill"
  },
  alerts: {
    overdue: '{count, plural, one {# overdue bill} other {# overdue bills}}',
    dueSoon:
      '{count, plural, one {# bill is due} other {# bills are due}} {days, plural, =0 {today} one {within # day} other {within # days}}'
  }
} as const satisfies LocaleMessages<Messages['bills']>;
