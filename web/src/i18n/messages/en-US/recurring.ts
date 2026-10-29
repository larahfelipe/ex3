import type { LocaleMessages, Messages } from '../catalog';

export default {
  title: 'Recurring',
  description:
    'Expenses that repeat every week, month or year, and the bills each one generates ahead of time',
  add: 'Add recurring expense',
  list: 'Recurring expenses',
  status: 'Status',
  allStatuses: 'All statuses',
  loading: 'Loading recurring expenses',
  loadFailed: "Couldn't load the recurring expenses",
  empty: 'No recurring expenses yet',
  noResults:
    '{status, select, ACTIVE {No active recurring expenses} ENDED {No ended recurring expenses} other {No stopped recurring expenses}}',
  emptyPage: 'No recurring expenses on page {page, number}',
  goToPage: 'Go to page {page, number}',
  pages: 'Recurring expense pages',
  count:
    '{count, plural, =0 {No recurring expenses} one {# recurring expense} other {# recurring expenses}}',
  row: {
    meta: '{category} · {frequency}',
    noMoreBills: 'No upcoming bills',
    ended: 'Ended on <day></day>',
    noBillAhead: 'No bill scheduled',
    next: 'Next on <day></day>',
    nextWithDistance: 'Next on <day></day> · {distance}',
    amount: '<money></money><muted> {period}</muted>',
    estimatedAmount:
      '<muted>about </muted><money></money><muted> {period}</muted>',
    monthlyEquivalent: 'about {amount} per month'
  },
  details: {
    title: 'Recurring expense',
    loadFailed: "Couldn't load this recurring expense",
    loading: 'Loading the recurring expense',
    summary: '{frequency} in {currency}',
    amount: 'Amount {period}',
    estimate: 'Estimate {period}',
    monthly: 'Monthly equivalent',
    nextBill: 'Next bill',
    schedule: 'Schedule',
    scheduleOpen: 'From <start></start>, with no end date',
    scheduleRange: 'From <start></start> to <end></end>',
    category: 'Category',
    paymentMethod: 'Payment method',
    account: 'Bank account or card',
    notes: 'Notes',
    history: 'History',
    stop: 'Stop recurrence'
  },
  occurrences: {
    title: 'Bills',
    view: 'Show bills',
    views: { upcoming: 'Upcoming', earlier: 'Earlier' },
    empty: {
      upcoming: 'No upcoming bills',
      earlier: 'No earlier bills'
    },
    loading: 'Loading the bills',
    loadFailed: "Couldn't load the bills",
    table: '{view, select, upcoming {Upcoming bills} other {Earlier bills}}',
    pages:
      '{view, select, upcoming {Upcoming bill pages} other {Earlier bill pages}}',
    count: '{count, plural, =0 {No bills} one {# bill} other {# bills}}',
    columns: {
      due: 'Due date',
      amount: 'Amount',
      status: 'Status',
      actions: 'Actions'
    },
    customized: 'Edited individually',
    outstanding: '{amount} outstanding',
    pay: 'Pay<hidden> the bill due on {day}</hidden>',
    bill: 'Bill<hidden> due on {day}</hidden>'
  },
  deletion: {
    title: 'Delete this recurring expense?',
    description:
      "{description}. The recurrence and its bills are removed along with the history, and this can't be undone. A recurrence with payments can't be deleted: stop it to keep the record.",
    confirm: 'Delete recurrence',
    failed: "Couldn't delete the recurring expense"
  },
  form: {
    addTitle: 'Add recurring expense',
    addDescription:
      'Each occurrence becomes a bill, which stays outstanding until you record its payment. Bills are generated up to {months, plural, one {# month} other {# months}} ahead.',
    editTitle: 'Edit recurring expense',
    editDescription:
      '{frequency} from {day}, in {currency}. To change the frequency or the start, stop this recurrence and add a new one.',
    editNote:
      "Changes apply to the bills due from the date below that have no payments and weren't edited individually. Earlier bills keep their amounts.",
    scheduleSection: 'Amount and schedule',
    amount: 'Amount',
    amountKind: 'Amount type',
    amountKinds: { fixed: 'Fixed', variable: 'Variable' },
    amountKindHints: {
      fixed: 'Every bill will be this amount',
      variable: 'An estimate: correct each bill once you know its amount'
    },
    frequency: 'Frequency',
    frequencyHint:
      "The frequency and the start date can't change after the recurrence is created",
    startDate: 'First due date',
    startDateHint:
      'Within the last {months, plural, one {# month} other {# months}} or later',
    ends: 'Ends',
    endModes: { never: 'No end date', date: 'On a date' },
    endDate: 'End date',
    endDateHint: 'The last bill is due on this date or earlier',
    effectiveFrom: 'Apply from',
    submitAdd: 'Add recurring expense',
    failed: "Couldn't save the recurring expense"
  },
  preview: {
    empty: 'The first bills appear here once the start date is filled in.',
    first:
      '{count, plural, one {The first bill is due on {days}} other {The first bills are due on {days}}}',
    then: 'Then one {period}, with no end date',
    thenUntil: 'Then one {period}, until {day}'
  },
  stop: {
    title: 'Stop {description}?',
    description:
      "From the date below, bills without payments are removed. Earlier bills and partly paid ones stay outstanding. The recurrence and its history are kept, and a stopped recurrence can't be resumed.",
    effectiveFrom: 'Stop from',
    keep: 'Keep',
    submit: 'Stop recurrence',
    failed: "Couldn't stop the recurring expense"
  }
} as const satisfies LocaleMessages<Messages['recurring']>;
