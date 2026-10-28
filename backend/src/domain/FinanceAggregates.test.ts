import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { monthsBetween, parseCalendarDay } from './CalendarDay';
import {
  type AggregateExpense,
  type AggregatePayment,
  calendarDaysOf,
  categoryFiguresOf,
  changeOf,
  commitmentsOf,
  dueSoonOf,
  kindFiguresOf,
  monthlyFiguresOf,
  outstandingByCurrencyOf,
  overdueOf,
  remindsUpcoming,
  totalsOf
} from './FinanceAggregates';

const day = (value: string) => parseCalendarDay(value) as Date;

const TODAY = day('2026-10-26');

const expense = (
  overrides: Partial<AggregateExpense> & Pick<AggregateExpense, 'dueDate'>
): AggregateExpense => ({
  amount: '100',
  settledAmount: '0',
  settledOn: null,
  cancelledAt: null,
  category: 'HOUSING',
  kind: 'ONE_TIME',
  ...overrides
});

const payment = (
  overrides: Partial<AggregatePayment> & Pick<AggregatePayment, 'paidOn'>
): AggregatePayment => ({
  amount: '100',
  fees: '0',
  discount: '0',
  category: 'HOUSING',
  kind: 'ONE_TIME',
  ...overrides
});

const EXPENSES = [
  expense({ dueDate: day('2026-09-20'), amount: '80' }),
  expense({
    dueDate: day('2026-10-05'),
    amount: '200',
    settledAmount: '200',
    settledOn: day('2026-10-05'),
    category: 'UTILITIES'
  }),
  expense({
    dueDate: day('2026-10-20'),
    amount: '150',
    settledAmount: '50',
    kind: 'INSTALLMENT'
  }),
  expense({ dueDate: day('2026-10-28'), amount: '60', kind: 'RECURRING' }),
  expense({
    dueDate: day('2026-10-30'),
    amount: '999',
    cancelledAt: new Date()
  }),
  expense({ dueDate: day('2026-11-10'), amount: '150', kind: 'INSTALLMENT' })
];

const PAYMENTS = [
  payment({
    paidOn: day('2026-10-05'),
    amount: '200',
    fees: '2.5',
    category: 'UTILITIES'
  }),
  payment({
    paidOn: day('2026-10-21'),
    amount: '45',
    discount: '5',
    kind: 'INSTALLMENT'
  }),
  payment({ paidOn: day('2026-09-02'), amount: '30' })
];

describe('overdueOf and dueSoonOf', () => {
  it('counts what is still owed past the due day, and nothing cancelled or paid', () => {
    assert.deepEqual(overdueOf(EXPENSES, TODAY), { amount: '180', count: 2 });
  });

  it('counts what falls due from the reference day through the lead days', () => {
    assert.deepEqual(dueSoonOf(EXPENSES, TODAY, 3), { amount: '60', count: 1 });
    assert.deepEqual(dueSoonOf(EXPENSES, TODAY, 0), { amount: '0', count: 0 });
  });
});

describe('remindsUpcoming', () => {
  it('follows the installment switch for installments and the bill switch for every other kind', () => {
    const reminders = {
      remindUpcomingBills: false,
      remindUpcomingInstallments: true
    };

    assert.equal(remindsUpcoming('INSTALLMENT', reminders), true);
    assert.equal(remindsUpcoming('ONE_TIME', reminders), false);
    assert.equal(remindsUpcoming('RECURRING', reminders), false);
    assert.equal(
      remindsUpcoming('INSTALLMENT', {
        remindUpcomingBills: true,
        remindUpcomingInstallments: false
      }),
      false
    );
  });
});

describe('totalsOf', () => {
  it('separates what was planned, settled, paid, outstanding and overdue', () => {
    assert.deepEqual(
      totalsOf(EXPENSES, PAYMENTS, {
        from: day('2026-10-01'),
        to: day('2026-10-31'),
        today: TODAY
      }),
      {
        scheduled: { amount: '410', count: 3 },
        paid: { amount: '247.5', count: 2 },
        settled: '250',
        outstanding: { amount: '160', count: 2 },
        overdue: { amount: '100', count: 1 },
        fees: '2.5',
        discounts: '5'
      }
    );
  });
});

describe('monthlyFiguresOf', () => {
  it('gives one row per month, empty months included', () => {
    const rows = monthlyFiguresOf(
      EXPENSES,
      PAYMENTS,
      monthsBetween(day('2026-08-01'), day('2026-11-01')),
      TODAY
    );

    assert.deepEqual(
      rows.map(({ month, scheduled, paid }) => [month, scheduled, paid]),
      [
        ['2026-08', '0', '0'],
        ['2026-09', '80', '30'],
        ['2026-10', '410', '247.5'],
        ['2026-11', '150', '0']
      ]
    );
  });
});

describe('categoryFiguresOf', () => {
  it('ranks categories by scheduled amount with their share of the total', () => {
    assert.deepEqual(
      categoryFiguresOf(EXPENSES, PAYMENTS, {
        from: day('2026-10-01'),
        to: day('2026-10-31')
      }),
      [
        {
          category: 'HOUSING',
          scheduled: '210',
          paid: '45',
          share: '0.512195121951219512'
        },
        {
          category: 'UTILITIES',
          scheduled: '200',
          paid: '202.5',
          share: '0.487804878048780487'
        }
      ]
    );
  });
});

describe('kindFiguresOf', () => {
  it('splits the period by the origin of each expense', () => {
    assert.deepEqual(
      kindFiguresOf(EXPENSES, PAYMENTS, {
        from: day('2026-10-01'),
        to: day('2026-10-31')
      }),
      [
        { kind: 'ONE_TIME', scheduled: '200', paid: '202.5' },
        { kind: 'INSTALLMENT', scheduled: '150', paid: '45' },
        { kind: 'RECURRING', scheduled: '60', paid: '0' }
      ]
    );
  });
});

describe('commitmentsOf', () => {
  it('projects what is still to pay in each month, by origin', () => {
    assert.deepEqual(
      commitmentsOf(
        EXPENSES,
        monthsBetween(day('2026-10-01'), day('2026-11-01'))
      ),
      [
        {
          month: '2026-10',
          oneTime: '0',
          installments: '100',
          recurring: '60',
          total: '160'
        },
        {
          month: '2026-11',
          oneTime: '0',
          installments: '150',
          recurring: '0',
          total: '150'
        }
      ]
    );
  });
});

describe('changeOf', () => {
  it('is the difference and its fraction of the previous value', () => {
    assert.deepEqual(changeOf('150', '100'), { amount: '50', percent: '0.5' });
    assert.deepEqual(changeOf('50', '0'), { amount: '50', percent: null });
  });
});

describe('calendarDaysOf', () => {
  it('groups the owed expenses by day, with totals kept apart by currency', () => {
    assert.deepEqual(
      calendarDaysOf(
        [
          { ...expense({ dueDate: day('2026-10-28') }), currency: 'USD' },
          {
            ...expense({ dueDate: day('2026-10-05'), amount: '40' }),
            currency: 'BRL'
          },
          {
            ...expense({
              dueDate: day('2026-10-05'),
              amount: '60',
              settledAmount: '60',
              settledOn: day('2026-10-04')
            }),
            currency: 'BRL'
          },
          {
            ...expense({ dueDate: day('2026-10-28'), amount: '25.5' }),
            currency: 'BRL'
          },
          {
            ...expense({
              dueDate: day('2026-10-28'),
              cancelledAt: new Date()
            }),
            currency: 'BRL'
          }
        ],
        TODAY
      ),
      [
        {
          date: '2026-10-05',
          count: 2,
          paidCount: 1,
          overdueCount: 1,
          totals: [{ currency: 'BRL', amount: '100', outstanding: '40' }]
        },
        {
          date: '2026-10-28',
          count: 2,
          paidCount: 0,
          overdueCount: 0,
          totals: [
            { currency: 'BRL', amount: '25.5', outstanding: '25.5' },
            { currency: 'USD', amount: '100', outstanding: '100' }
          ]
        }
      ]
    );
  });

  it('leaves out a day whose expenses are all cancelled', () => {
    assert.deepEqual(
      calendarDaysOf(
        [
          {
            ...expense({ dueDate: day('2026-10-10'), cancelledAt: new Date() }),
            currency: 'BRL'
          }
        ],
        TODAY
      ),
      []
    );
  });
});

describe('outstandingByCurrencyOf', () => {
  it('sums each currency on its own, exactly', () => {
    assert.deepEqual(
      outstandingByCurrencyOf([
        { currency: 'USD', outstandingAmount: '0.1' },
        { currency: 'BRL', outstandingAmount: '0.1' },
        { currency: 'USD', outstandingAmount: '0.2' }
      ]),
      [
        { currency: 'BRL', amount: '0.1' },
        { currency: 'USD', amount: '0.3' }
      ]
    );
  });
});
