import type { LocaleMessages, Messages } from '../catalog';

export default {
  title: 'Calendar',
  description:
    'Bills by due date: what is overdue, due and paid on each day of the month',
  months: 'Months',
  thisMonth: 'This month',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  loading: 'Loading the calendar',
  loadFailed: "Couldn't load the calendar",
  caption: 'Bills due in {month}',
  nothingDueInMonth: 'Nothing is due in {month}.',
  chooseDay: 'Choose a day to see the bills due on it.',
  legend: {
    overdue: 'Overdue',
    due: 'Due',
    paid: 'Paid'
  },
  markers: {
    overdue: '{count, plural, other {overdue}}',
    due: 'due',
    paid: '{count, plural, other {paid}}'
  },
  dayLabel: '{day}: {summary}',
  daySummary: {
    none: 'nothing due',
    overdue: '{count, plural, one {# overdue bill} other {# overdue bills}}',
    due: '{count, number} due',
    paid: '{count, plural, other {# paid}}'
  },
  day: {
    nothingDue: 'Nothing due',
    allPaid: 'All paid',
    leftToPay: '{amounts} left to pay',
    loading: "Loading the day's bills",
    loadFailed: "Couldn't load the day's bills",
    empty: 'No bills are due on this day',
    list: 'Bills due on {day}',
    pages: "Pages of the day's bills",
    count: '{count, plural, =0 {No bills} one {# bill} other {# bills}}',
    meta: '{origin} · {category}',
    outstanding: '{amount} outstanding'
  }
} as const satisfies LocaleMessages<Messages['calendar']>;
