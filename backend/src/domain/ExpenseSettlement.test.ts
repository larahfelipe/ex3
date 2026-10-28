import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCalendarDay } from './CalendarDay';
import {
  expenseKindOf,
  expenseStatusOf,
  settleExpense
} from './ExpenseSettlement';

const day = (value: string) => parseCalendarDay(value) as Date;

const payment = (
  amount: string,
  paidOn: string,
  { discount = '0', voided = false } = {}
) => ({
  amount,
  discount,
  paidOn: day(paidOn),
  voidedAt: voided ? new Date() : null
});

describe('settleExpense', () => {
  it('leaves an expense without payments fully outstanding', () => {
    assert.deepEqual(settleExpense('150', []), {
      outcome: 'settled',
      settledAmount: '0',
      outstandingAmount: '150',
      settledOn: null
    });
  });

  it('keeps a partly paid expense open', () => {
    assert.deepEqual(settleExpense('150', [payment('100', '2026-10-05')]), {
      outcome: 'settled',
      settledAmount: '100',
      outstandingAmount: '50',
      settledOn: null
    });
  });

  it('settles on the latest payment day once the payments cover the amount', () => {
    assert.deepEqual(
      settleExpense('150', [
        payment('50', '2026-10-20'),
        payment('100', '2026-10-05')
      ]),
      {
        outcome: 'settled',
        settledAmount: '150',
        outstandingAmount: '0',
        settledOn: day('2026-10-20')
      }
    );
  });

  it('counts a discount as settled, without cash', () => {
    const settlement = settleExpense('100', [
      payment('95', '2026-10-05', { discount: '5' })
    ]);

    assert.equal(settlement.outcome, 'settled');
    assert.equal(
      settlement.outcome === 'settled' && settlement.outstandingAmount,
      '0'
    );
  });

  it('ignores a voided payment', () => {
    const settlement = settleExpense('100', [
      payment('100', '2026-10-05', { voided: true }),
      payment('40', '2026-10-06')
    ]);

    assert.equal(
      settlement.outcome === 'settled' && settlement.settledAmount,
      '40'
    );
  });

  it('refuses payments that settle more than the amount', () => {
    assert.deepEqual(
      settleExpense('100', [
        payment('100', '2026-10-05'),
        payment('0.01', '2026-10-05')
      ]),
      { outcome: 'over-settled' }
    );
  });
});

describe('expenseStatusOf', () => {
  const today = day('2026-10-26');

  it('is pending through the due day and overdue after it', () => {
    const open = { settledOn: null, cancelledAt: null };

    assert.equal(
      expenseStatusOf({ ...open, dueDate: day('2026-10-26') }, today),
      'PENDING'
    );
    assert.equal(
      expenseStatusOf({ ...open, dueDate: day('2026-10-25') }, today),
      'OVERDUE'
    );
  });

  it('is paid once settled, even if settled late', () => {
    assert.equal(
      expenseStatusOf(
        {
          dueDate: day('2026-09-01'),
          settledOn: day('2026-09-10'),
          cancelledAt: null
        },
        today
      ),
      'PAID'
    );
  });

  it('is cancelled above every other state', () => {
    assert.equal(
      expenseStatusOf(
        {
          dueDate: day('2026-09-01'),
          settledOn: null,
          cancelledAt: new Date()
        },
        today
      ),
      'CANCELLED'
    );
  });
});

describe('expenseKindOf', () => {
  it('tells the origin of an expense', () => {
    assert.equal(
      expenseKindOf({ installmentPlanId: null, recurringExpenseId: null }),
      'ONE_TIME'
    );
    assert.equal(
      expenseKindOf({ installmentPlanId: 'plan', recurringExpenseId: null }),
      'INSTALLMENT'
    );
    assert.equal(
      expenseKindOf({ installmentPlanId: null, recurringExpenseId: 'series' }),
      'RECURRING'
    );
  });
});
