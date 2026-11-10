import type { LocaleMessages, Messages } from '../catalog';

export default {
  title: 'Installment plans',
  description:
    'Installment purchases: what is left on each plan and when the next installment is due',
  add: 'Add installment plan',
  plans: 'Installment plans',
  status: 'Status',
  allStatuses: 'All statuses',
  loading: 'Loading installment plans',
  loadFailed: "Couldn't load the installment plans",
  emptyTitle: 'No installment plans yet',
  empty:
    'An installment purchase appears here with its progress, what is left and its next due date, and its bills join the others.',
  noResults:
    '{status, select, ACTIVE {No active installment plans} COMPLETED {No completed installment plans} other {No cancelled installment plans}}',
  emptyPage: 'No installment plans on page {page, number}',
  goToPage: 'Go to page {page, number}',
  list: 'Installment plans',
  pages: 'Installment plan pages',
  count:
    '{count, plural, =0 {No installment plans} one {# installment plan} other {# installment plans}}',
  outstandingOf: 'outstanding of {total}',
  details: {
    title: 'Installment plan',
    loadFailed: "Couldn't load this installment plan",
    loading: 'Loading the installment plan',
    summary:
      '{count, plural, one {# {frequency, select, WEEKLY {weekly} MONTHLY {monthly} other {yearly}} installment} other {# {frequency, select, WEEKLY {weekly} MONTHLY {monthly} other {yearly}} installments}} in {currency}',
    total: 'Total',
    outstanding: 'Outstanding',
    settled: 'Settled',
    nextInstallment: 'Next installment',
    next: '{number, number} of {count, number}, <day></day>',
    cashPrice: 'Cash price',
    overCashPrice: 'Over the cash price',
    financingNone: 'None',
    financingBelow: '{amount} below the cash price',
    schedule: 'Schedule',
    scheduleRange: '<first></first> to <last></last>',
    category: 'Category',
    paymentMethod: 'Payment method',
    account: 'Bank account or card',
    notes: 'Notes',
    installments: 'Installments',
    table: 'Installments table',
    columns: {
      installment: 'Installment',
      due: 'Due date',
      amount: 'Amount',
      status: 'Status',
      actions: 'Actions'
    },
    history: 'History',
    cancel: 'Cancel installment plan',
    reschedule: 'Reschedule'
  },
  installment: {
    position: '{number, number} of {count, number}',
    outstanding: '{amount} outstanding',
    pay: 'Pay<hidden> installment {position}</hidden>',
    bill: 'Bill<hidden> for installment {position}</hidden>'
  },
  cancellation: {
    title: 'Cancel this installment plan?',
    description:
      "{description}. Installments without payments are cancelled and no longer count as owed; a partly paid installment stays outstanding. The plan and its history are kept, and this can't be undone.",
    confirm: 'Cancel installment plan',
    failed: "Couldn't cancel the installment plan"
  },
  deletion: {
    title: 'Delete this installment plan?',
    description:
      "{description}. The plan and {count, plural, one {its # installment} other {its # installments}} are removed along with the history, and this can't be undone. To keep the record, cancel it instead.",
    confirm: 'Delete installment plan',
    failed: "Couldn't delete the installment plan"
  },
  form: {
    addTitle: 'Add installment plan',
    addDescription:
      'Each installment becomes a bill, which stays outstanding until you record its payment.',
    editTitle: 'Edit installment plan',
    editDescription:
      'Amounts in {currency}. To change what is still outstanding, reschedule the plan.',
    editNote:
      'The description applies to the outstanding installments, except the ones you edited individually. Paid installments keep their description.',
    scheduleSection: 'Amount and schedule',
    amountMode: 'Amount entered as',
    amountModes: { total: 'Total', installment: 'Per installment' },
    amounts: { total: 'Total amount', installment: 'Installment amount' },
    amountHints: {
      total:
        'Split evenly; the first installment takes the cents left over from the split',
      installment: 'Each installment will be this amount'
    },
    cashPrice: 'Cash price',
    cashPriceHint: 'What paying it all at once would cost',
    cashPriceCompared: 'The installments add up to {total}: {difference}',
    cashPriceSame: 'the same amount',
    count: 'Installments',
    countHint: 'From 1 to {max, number}, one {period}',
    frequency: 'Frequency',
    firstDueDate: 'First due date',
    submitAdd: 'Add installment plan',
    failed: "Couldn't save the installment plan"
  },
  summary: {
    label: 'Installments summary',
    empty:
      'The installments, the total and the dates appear here once the amount and the number of installments are filled in.',
    installments: '{count, number} × {amount}',
    installmentsPerPeriod: '{count, number} × {amount}<muted> {period}</muted>',
    firstDiffers:
      'The first installment is {amount}, with the cents left over from the split',
    total: 'Total to pay',
    dueOn: 'Due date',
    dueSpan: 'First and last due dates',
    dueSpanValue: '{first} to {last}',
    comparedWithCashPrice: 'Compared with the cash price',
    noDifference: 'No difference',
    difference:
      '{amount} {direction, select, more {more} other {less}} ({percent})',
    notes: {
      lastDayOfMonth: 'In shorter months, it is due on the last day',
      february28: 'Outside leap years, it is due on February 28'
    }
  },
  reschedule: {
    title: 'Reschedule {description}',
    description:
      'Replaces what is left to pay with new {frequency, select, WEEKLY {weekly} MONTHLY {monthly} other {yearly}} installments. Paid installments and the history are kept.',
    noneOwed:
      'No installment is outstanding: the new ones will be everything the plan charges.',
    noPayments: 'No installment has a payment yet, so {replaced}.',
    kept: '{number, plural, =1 {Installment 1 has a payment and stays as it is} other {Installments 1 to # stay as they are, through the last one with a payment}}',
    keptThenAdded: '{kept}; the new installments come after.',
    keptThenReplaced: '{kept}. After that, {replaced}.',
    replaced:
      '{count, plural, one {the outstanding installment is replaced} other {the # outstanding installments are replaced}}',
    amount: 'Remaining amount',
    amountHint:
      'Split evenly; the first new installment takes the cents left over from the split',
    count: 'Installments',
    nextDueDate: 'Next due date',
    submit: 'Reschedule',
    failed: "Couldn't reschedule the installment plan"
  },
  progress: {
    allPaid:
      '{count, plural, one {The only installment was paid} other {All # installments paid}}',
    cancelledOwing: 'Cancelled, {amount} still outstanding',
    cancelled: 'Cancelled',
    installments: '{count, plural, one {# installment} other {# installments}}',
    next: 'Installment {number, number} of {count, number}, <day></day>'
  }
} as const satisfies LocaleMessages<Messages['installments']>;
