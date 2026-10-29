import type { LocaleMessages, Messages } from '../catalog';

export default {
  title: 'Finances',
  headerDescription: '{month} · Amounts in {currency}',
  add: 'Add bill',
  loading: 'Loading your finances',
  loadFailed: "Couldn't load your finances",
  emptyAll:
    'No bills yet. Add a bill, an installment purchase or a recurring expense to see them here.',
  emptyCurrency: 'No bills in {currency}',
  metrics: {
    outstanding: 'Total outstanding',
    nothingOwed: 'Nothing outstanding',
    outstandingDetail:
      '{count, plural, one {# bill} other {# bills}}, due any time; recurring ones through this month',
    owedThisMonth: 'Outstanding this month',
    bills: '{count, plural, =0 {No bills} one {# bill} other {# bills}}',
    overdue: 'Overdue',
    nothingOverdue: 'Nothing overdue',
    overdueDetail:
      '{count, plural, one {# overdue bill} other {# overdue bills}}, from any month',
    paidThisMonth: 'Paid this month',
    plannedThisMonth: 'Planned for this month'
  },
  upcoming: {
    title: 'Upcoming bills',
    allPending: 'All pending',
    empty: 'Nothing pending in {currency}'
  },
  trend: {
    title: 'Planned and paid',
    description:
      '{count, plural, one {The last month} other {The last # months}}, in {currency}. Planned is what came due; paid is the money that went out, by payment date.',
    chartTitle: 'Planned and paid by month',
    planned: 'Planned',
    paid: 'Paid',
    link: 'Opens the bills due that month'
  },
  commitments: {
    title: 'Coming months',
    description:
      'What comes due from {month} on, by type. Months with recurring expenses show only the occurrences already generated.',
    chartTitle: 'Commitments by month',
    oneTime: 'One-time',
    installments: 'Installments',
    recurring: 'Recurring'
  },
  categories: {
    title: 'By category',
    description: 'Planned for {month}, in {currency}',
    empty: 'Nothing planned for this month',
    paid: 'Paid: {amount}'
  },
  installments: {
    title: 'Installment plans',
    link: 'View installment plans',
    none: 'No active installment plans',
    detail:
      'Left to pay across {plans, plural, one {# active plan} other {# active plans}}, in {installments, plural, one {# installment} other {# installments}}'
  },
  recurring: {
    title: 'Recurring',
    link: 'View recurring expenses',
    none: 'No active recurring expenses',
    detail:
      'Per month, across {count, plural, one {# active recurring expense} other {# active recurring expenses}}'
  },
  reminders: {
    title: 'Reminders',
    change: 'Change',
    off: 'Off',
    overdueOnly: 'Overdue bills only',
    onDueDay: 'On the due date',
    leadDays: '{days, plural, one {# day} other {# days}} before the due date',
    nothingFlagged: 'Nothing is flagged on this page or in the navigation.',
    flagged: '{items} are flagged on this page and in the navigation.',
    noExternal: 'No email or push notification is sent.',
    items: {
      overdue: 'overdue bills',
      bills: 'bills due soon',
      installments: 'installments due soon'
    },
    settings: {
      description:
        'Choose what is flagged on the overview and in the navigation, and how many days ahead. Reminders appear only in the app.',
      remindOf: 'Remind me of',
      switches: {
        remindOverdue: 'Overdue bills',
        remindUpcomingBills: 'Bills due soon',
        remindUpcomingInstallments: 'Installments due soon'
      },
      leadDays: 'Days before the due date',
      leadDaysHint:
        'For bills and installments due soon. With 0, they are flagged on their due date; at most {max, number}',
      submit: 'Save reminders',
      failed: "Couldn't save the reminders"
    }
  }
} as const satisfies LocaleMessages<Messages['financeOverview']>;
