import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatCalendarDay, parseCalendarDay } from './CalendarDay';
import {
  describeInstallmentPlan,
  reschedulableInstallments,
  scheduleInstallments
} from './InstallmentSchedule';

const day = (value: string) => parseCalendarDay(value) as Date;

describe('scheduleInstallments', () => {
  it('splits the total monthly from the first due date', () => {
    const schedule = scheduleInstallments({
      amount: { totalAmount: '1000' },
      count: 3,
      firstDueDate: day('2026-01-31'),
      frequency: 'MONTHLY',
      currency: 'BRL',
      firstNumber: 1
    });

    assert.deepEqual(
      schedule?.map(({ installmentNumber, dueDate, amount }) => [
        installmentNumber,
        formatCalendarDay(dueDate),
        amount
      ]),
      [
        [1, '2026-01-31', '333.34'],
        [2, '2026-02-28', '333.33'],
        [3, '2026-03-31', '333.33']
      ]
    );
  });

  it('falls due weekly or yearly from the first due date when that is the frequency', () => {
    const dueDatesOf = (frequency: 'WEEKLY' | 'YEARLY', firstDueDate: string) =>
      scheduleInstallments({
        amount: { totalAmount: '90' },
        count: 3,
        firstDueDate: day(firstDueDate),
        frequency,
        currency: 'BRL',
        firstNumber: 1
      })?.map(({ dueDate }) => formatCalendarDay(dueDate));

    assert.deepEqual(dueDatesOf('WEEKLY', '2026-12-24'), [
      '2026-12-24',
      '2026-12-31',
      '2027-01-07'
    ]);
    assert.deepEqual(dueDatesOf('YEARLY', '2028-02-29'), [
      '2028-02-29',
      '2029-02-28',
      '2030-02-28'
    ]);
  });

  it('repeats the installment amount when that is what was agreed', () => {
    const schedule = scheduleInstallments({
      amount: { installmentAmount: '99.9' },
      count: 10,
      firstDueDate: day('2026-11-10'),
      frequency: 'MONTHLY',
      currency: 'BRL',
      firstNumber: 5
    });

    assert.equal(schedule?.length, 10);
    assert.equal(schedule?.[0].installmentNumber, 5);
    assert.equal(schedule?.at(-1)?.installmentNumber, 14);
    assert.ok(schedule?.every(({ amount }) => amount === '99.9'));
  });

  it('refuses a total too small for the count', () => {
    assert.equal(
      scheduleInstallments({
        amount: { totalAmount: '0.02' },
        count: 3,
        firstDueDate: day('2026-11-10'),
        frequency: 'MONTHLY',
        currency: 'BRL',
        firstNumber: 1
      }),
      null
    );
  });
});

describe('describeInstallmentPlan', () => {
  const installment = (
    installmentNumber: number,
    dueDate: string,
    { settledAmount = '0', paid = false, cancelled = false } = {}
  ) => ({
    installmentNumber,
    amount: '100',
    settledAmount: paid ? '100' : settledAmount,
    dueDate: day(dueDate),
    settledOn: paid ? day(dueDate) : null,
    cancelledAt: cancelled ? new Date() : null
  });

  it('reports progress, what remains and the next installment', () => {
    const progress = describeInstallmentPlan(
      [
        installment(3, '2026-12-10'),
        installment(1, '2026-10-10', { paid: true }),
        installment(2, '2026-11-10', { settledAmount: '40' })
      ],
      { principalAmount: '270', cancelledAt: null }
    );

    assert.deepEqual(progress, {
      status: 'ACTIVE',
      installmentCount: 3,
      totalAmount: '300',
      settledAmount: '140',
      outstandingAmount: '160',
      financingCost: '30',
      paidInstallments: 1,
      remainingInstallments: 2,
      nextDueDate: '2026-11-10',
      nextInstallmentNumber: 2,
      firstDueDate: '2026-10-10',
      lastDueDate: '2026-12-10'
    });
  });

  it('is complete once every owed installment is paid', () => {
    const progress = describeInstallmentPlan(
      [installment(1, '2026-10-10', { paid: true })],
      { principalAmount: null, cancelledAt: null }
    );

    assert.equal(progress.status, 'COMPLETED');
    assert.equal(progress.nextDueDate, null);
    assert.equal(progress.financingCost, null);
  });

  it('leaves cancelled installments out of every total', () => {
    const progress = describeInstallmentPlan(
      [
        installment(1, '2026-10-10', { paid: true }),
        installment(2, '2026-11-10', { cancelled: true })
      ],
      { principalAmount: '120', cancelledAt: new Date() }
    );

    assert.equal(progress.status, 'CANCELLED');
    assert.equal(progress.totalAmount, '100');
    assert.equal(progress.outstandingAmount, '0');
    assert.equal(progress.installmentCount, 1);
    assert.equal(progress.financingCost, '-20');
  });
});

describe('reschedulableInstallments', () => {
  it('takes only the installments after the last one with payments', () => {
    const numbers = reschedulableInstallments([
      { installmentNumber: 1, hasPayments: true },
      { installmentNumber: 2, hasPayments: false },
      { installmentNumber: 3, hasPayments: true },
      { installmentNumber: 4, hasPayments: false },
      { installmentNumber: 5, hasPayments: false }
    ]).map(({ installmentNumber }) => installmentNumber);

    assert.deepEqual(numbers, [4, 5]);
  });

  it('takes every installment of a plan without payments', () => {
    assert.equal(
      reschedulableInstallments([
        { installmentNumber: 1, hasPayments: false },
        { installmentNumber: 2, hasPayments: false }
      ]).length,
      2
    );
  });
});
