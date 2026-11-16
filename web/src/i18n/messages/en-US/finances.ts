import type { LocaleMessages, Messages } from '../catalog';

export default {
  categories: {
    HOUSING: 'Housing',
    UTILITIES: 'Utilities',
    SUBSCRIPTIONS: 'Subscriptions',
    FOOD: 'Food',
    TRANSPORTATION: 'Transportation',
    HEALTH: 'Health & wellness',
    EDUCATION: 'Education',
    LEISURE: 'Leisure',
    SHOPPING: 'Shopping',
    FINANCIAL: 'Financial',
    OTHER: 'Other'
  },
  categoryExamples: {
    HOUSING: 'Rent, condo fees, property tax, repairs',
    UTILITIES: 'Electricity, water, gas, internet, phone',
    SUBSCRIPTIONS: 'Streaming, apps, software, subscription boxes',
    FOOD: 'Groceries, restaurants, delivery',
    TRANSPORTATION: 'Fuel, vehicle tax, car insurance, parking, public transit',
    HEALTH: 'Health plan, pharmacy, appointments, gym, personal care',
    EDUCATION: 'School, college, courses, books, supplies',
    LEISURE: 'Travel, outings, events, hobbies',
    SHOPPING: 'Clothing, electronics, home goods, gifts',
    FINANCIAL: 'Loans, credit card bill, taxes, insurance, bank fees',
    OTHER: 'Anything that fits nowhere else'
  },
  retiredCategories: {
    INSURANCE: 'Insurance',
    TAXES: 'Taxes',
    DEBT: 'Debt',
    PERSONAL_CARE: 'Personal care'
  },
  paymentMethods: {
    CASH: 'Cash',
    DEBIT_CARD: 'Debit card',
    CREDIT_CARD: 'Credit card',
    BANK_TRANSFER: 'Bank transfer',
    PIX: 'Pix',
    BOLETO: 'Boleto',
    DIRECT_DEBIT: 'Direct debit',
    OTHER: 'Other'
  },
  cardBrands: {
    VISA: 'Visa',
    MASTERCARD: 'Mastercard'
  },
  frequencies: {
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
    YEARLY: 'Yearly'
  },
  perPeriod: {
    WEEKLY: 'per week',
    MONTHLY: 'per month',
    YEARLY: 'per year'
  },
  kinds: {
    ONE_TIME: 'One-time',
    INSTALLMENT: 'Installment',
    RECURRING: 'Recurring'
  },
  statuses: {
    PENDING: 'Pending',
    OVERDUE: 'Overdue',
    PAID: 'Paid',
    CANCELLED: 'Cancelled'
  },
  statusFilters: {
    OPEN: 'Open',
    PENDING: 'Pending',
    OVERDUE: 'Overdue',
    PAID: 'Paid',
    CANCELLED: 'Cancelled'
  },
  planStatuses: {
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  },
  seriesStatuses: {
    ACTIVE: 'Active',
    ENDED: 'Ended',
    CANCELLED: 'Stopped'
  },
  events: {
    CREATED: 'Created',
    UPDATED: 'Edited',
    CANCELLED: 'Cancelled',
    RESTORED: 'Restored',
    PAYMENT_RECORDED: 'Payment recorded',
    PAYMENT_CORRECTED: 'Payment corrected',
    PAYMENT_VOIDED: 'Payment voided',
    RESCHEDULED: 'Rescheduled'
  },
  changedFields: {
    description: 'description',
    category: 'category',
    subcategory: 'subcategory',
    paymentMethod: 'payment method',
    account: 'bank account or card',
    notes: 'notes',
    amount: 'amount',
    dueDate: 'due date',
    effectiveFrom: 'effective date',
    entryDate: 'purchase date',
    principalAmount: 'cash price',
    isVariable: 'variable amount',
    endDate: 'end date',
    discount: 'discount',
    fees: 'interest and late fees',
    paidOn: 'payment date',
    method: 'payment method',
    originalDueDate: 'bill due date',
    creditCard: 'card'
  },
  display: {
    installmentsPaid: 'Installments paid',
    progress: '{paid, number} of {count, number} paid',
    installmentOf: 'Installment {number, number} of {count, number}',
    dueIn:
      '{days, plural, =0 {Due today} =1 {Due tomorrow} other {Due in # days}}',
    overdueBy:
      '{days, plural, =1 {Was due yesterday} other {Was due # days ago}}'
  },
  history: {
    empty: 'No changes recorded',
    none: 'none',
    yes: 'yes',
    no: 'no',
    change: '{field}: {from} → {to}',
    card: '{name} ending in {lastFour}',
    changesFrom: '{changes}, from {day}',
    paid: '{amount} paid',
    paidOn: '{amount} paid on {day}',
    rescheduled:
      '{replaced, plural, =0 {No open installments replaced} one {# open installment replaced} other {# open installments replaced}} with {scheduled, number}',
    stopped:
      'Stopped from {day}; {dropped, plural, =0 {no unpaid occurrences removed} one {# unpaid occurrence removed} other {# unpaid occurrences removed}}'
  },
  summary: {
    withPercent: '{amount} ({percent})',
    same: '{period, select, lastMonth {Same as last month} other {Same amount as {period}}}',
    more: '{amount} more than {period, select, lastMonth {last month} other {{period}}}',
    less: '{amount} less than {period, select, lastMonth {last month} other {{period}}}'
  },
  charts: {
    table: 'Table: {title}',
    caption: '{title}, in {currency}',
    month: 'Month',
    showTable: 'Show table',
    hideTable: 'Hide table',
    column: '{month}: {values}',
    columnValue: '{label} {amount}',
    columnWithLink: '{description}. {link}'
  },
  navigation: {
    label: 'Finance sections',
    overview: 'Overview',
    bills: 'Bills',
    installments: 'Installments',
    recurring: 'Recurring',
    calendar: 'Calendar',
    reports: 'Reports'
  },
  form: {
    description: 'Description',
    descriptionPlaceholder: 'E.g. electricity bill',
    category: 'Category',
    moreDetailsSection: 'More details',
    addMoreDetails: 'More details',
    moreDetailsHint: 'Subcategory, payment method, account and notes',
    moreDetailsHintWithCard:
      'Subcategory, payment method and card, account and notes',
    subcategory: 'Subcategory',
    paymentMethod: 'Payment method',
    noPaymentMethod: 'Not specified',
    account: 'Bank account or card',
    notes: 'Notes',
    card: 'Card',
    noCard: 'No specific card',
    newCard: 'New card',
    cardHint: 'Choose one to make the bill fall due with its statement',
    cardHintInstallments:
      'Choose one to make the installments fall due with its statement',
    cardSetByPlan: 'Set on the plan: to change it, edit the plan.',
    billDueDate: 'Bill due date'
  },
  cardPreview: {
    due: 'Card payment due {day}',
    statement:
      'On the statement closing {closing}. The bill keeps its own due date, {bill}.',
    firstDue: 'First card payment due {day}',
    each: 'Each bill falls due with the statement it lands on, which closes on day {closingDay, number} and is due on day {dueDay, number}.',
    eachInstallment:
      'Each installment falls due with the statement it lands on, which closes on day {closingDay, number} and is due on day {dueDay, number}.'
  },
  cards: {
    digits: '<mask>•••• </mask><hidden>ending in </hidden>{lastFour}',
    removed: 'Removed',
    cycle: 'Closes on day {closingDay, number} · due on day {dueDay, number}',
    openBills:
      '{count, plural, =0 {No open bills} one {# open bill} other {# open bills}}',
    manage: {
      title: 'Credit cards',
      description:
        'Bills charged to a card fall due on the payment date of the statement they land on.',
      empty: 'No cards yet. Add one to choose it on your bills.',
      add: 'Add card',
      edit: 'Edit<hidden> {name}</hidden>',
      delete: 'Delete<hidden> {name}</hidden>',
      loading: 'Loading the cards',
      loadFailed: "Couldn't load the cards"
    },
    form: {
      addTitle: 'Add card',
      editTitle: 'Edit card',
      description:
        "Bills charged to it fall due on its statement's payment date.",
      privacy:
        'Never enter the full card number, the security code or the expiry date: the last four digits are enough to tell your cards apart.',
      name: 'Name',
      namePlaceholder: 'E.g. Nubank',
      lastFourDigits: 'Last four digits',
      brand: 'Brand',
      closingDay: 'Closing day',
      closingDayHint: 'Purchases from this day on go on the next statement',
      dueDay: 'Due day',
      dueDayHint: 'The day each statement is paid',
      followsNewDays:
        '{count, plural, one {The open bill on this card will follow the new days.} other {The # open bills on this card will follow the new days.}} Bills with payments keep their dates.',
      submitAdd: 'Add card',
      failed: "Couldn't save the card"
    },
    delete: {
      title: 'Delete {name}?',
      description:
        'Bills and recurring expenses charged to it keep their dates and show the card as removed. It can no longer be chosen for a bill.',
      confirm: 'Delete card',
      failed: "Couldn't delete the card"
    }
  },
  notifications: {
    billAdded: 'Bill added',
    billUpdated: 'Bill updated',
    billCancelled: 'Bill cancelled',
    billRestored: 'Bill restored',
    billDeleted: 'Bill deleted',
    paymentRecorded: 'Payment recorded',
    paymentUpdated: 'Payment updated',
    paymentVoided: 'Payment voided',
    planAdded: 'Installment plan added',
    planAddedDetail:
      '{description} in {count, plural, one {# installment} other {# installments}}',
    planUpdated: 'Installment plan updated',
    planRescheduled: 'Installment plan rescheduled',
    planCancelled: 'Installment plan cancelled',
    planDeleted: 'Installment plan deleted',
    seriesAdded: 'Recurring expense added',
    seriesUpdated: 'Recurring expense updated',
    seriesStopped: 'Recurrence stopped',
    seriesDeleted: 'Recurring expense deleted',
    remindersUpdated: 'Reminders updated',
    remindersOff: 'No bills are flagged',
    remindersOverdueOnly: 'Only overdue bills are flagged',
    remindersOnDueDay: 'Bills are flagged on their due date',
    remindersLeadDays:
      'Bills are flagged {days, plural, one {# day} other {# days}} before they are due',
    cardAdded: 'Card added',
    cardUpdated: 'Card updated',
    cardBillsMoved:
      '{count, plural, one {# open bill moved to its new payment date} other {# open bills moved to their new payment dates}}',
    cardDeleted: 'Card deleted'
  }
} as const satisfies LocaleMessages<Messages['finances']>;
