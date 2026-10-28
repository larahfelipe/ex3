import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { Errors, FinanceMessages } from '@/config';
import {
  addDays,
  addMonths,
  daysInMonth,
  endOfMonth,
  formatCalendarDay,
  formatCalendarMonth,
  startOfMonth,
  utcToday
} from '@/domain/CalendarDay';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signInUser } from '@/test/ApiClient';
import { FIXTURE_PASSWORD, MISSING_UUID } from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';
import { injectWriteFailure } from '@/test/TestDatabase';

const EXPENSES_ROUTE = '/v1/finances/expenses';
const PAYMENTS_ROUTE = '/v1/finances/payments';
const PLANS_ROUTE = '/v1/finances/installment-plans';
const SERIES_ROUTE = '/v1/finances/recurring-expenses';
const SUMMARY_ROUTE = '/v1/finances/summary';
const CALENDAR_ROUTE = '/v1/finances/calendar';
const REPORTS_ROUTE = '/v1/finances/reports';
const ALERTS_ROUTE = '/v1/finances/alerts';
const SETTINGS_ROUTE = '/v1/finances/settings';
const ACCOUNT_ROUTE = '/v1/user';

const expenseRoute = (id: string) => `${EXPENSES_ROUTE}/${id}`;
const paymentsRoute = (id: string) => `${expenseRoute(id)}/payments`;
const paymentRoute = (id: string, paymentId: string) =>
  `${paymentsRoute(id)}/${paymentId}`;
const planRoute = (id: string) => `${PLANS_ROUTE}/${id}`;
const seriesRoute = (id: string) => `${SERIES_ROUTE}/${id}`;

const INTRUDER_EMAIL = 'intruder@ex3.app';

/** The server's UTC day when the suite loads; every request may name a day within one of it. */
const TODAY = utcToday();

const dayFrom = (days: number) => formatCalendarDay(addDays(TODAY, days));

/** The first year after the current one whose February has `februaryDays` days. */
const comingYearWith = (februaryDays: 28 | 29) => {
  let year = TODAY.getUTCFullYear() + 1;

  while (daysInMonth(year, 1) !== februaryDays) year += 1;

  return year;
};

/** Plans start in a coming January, so their installments are never overdue and their month ends stay fixed. */
const PLAN_YEAR = comingYearWith(28);
const LEAP_YEAR = comingYearWith(29);

const planDay = (monthDay: string) => `${PLAN_YEAR}-${monthDay}`;

const EXPENSE = {
  description: 'Electricity',
  category: 'UTILITIES',
  amount: '100.00',
  currency: 'BRL',
  dueDate: dayFrom(10)
};

const PAYMENT = { amount: '40.00', paidOn: dayFrom(0) };

const DEFAULT_SETTINGS = {
  reminderLeadDays: 3,
  remindOverdue: true,
  remindUpcomingBills: true,
  remindUpcomingInstallments: true
};

const prismaClient = PrismaClient.getInstance();

describe('finances', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  const signIn = async (email?: string) => {
    const { user, accessToken } = await signInUser(email);
    const auth = bearer(accessToken);

    return {
      user,
      auth,
      get: (route: string, query: Record<string, string> = {}) =>
        client.get(route).query(query).set(auth),
      post: (route: string, body: object = {}) =>
        client.post(route).set(auth).send(body),
      patch: (route: string, body: object) =>
        client.patch(route).set(auth).send(body),
      put: (route: string, body: object) =>
        client.put(route).set(auth).send(body),
      remove: (route: string) => client.delete(route).set(auth)
    };
  };

  type Session = Awaited<ReturnType<typeof signIn>>;

  const createExpense = async (session: Session, overrides: object = {}) => {
    const res = await session.post(EXPENSES_ROUTE, {
      ...EXPENSE,
      ...overrides
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));

    return res.body.id as string;
  };

  const readExpense = async (session: Session, id: string) => {
    const res = await session.get(expenseRoute(id));

    assert.equal(res.status, 200, JSON.stringify(res.body));

    return res.body;
  };

  const pay = async (session: Session, id: string, payment: object = {}) => {
    const res = await session.post(paymentsRoute(id), {
      ...PAYMENT,
      ...payment
    });

    assert.equal(res.status, 201, JSON.stringify(res.body));

    return res.body.payment.id as string;
  };

  describe('expenses', () => {
    it('creates an expense that owes its whole amount and is not paid', async () => {
      const session = await signIn();

      const id = await createExpense(session);
      const expense = await readExpense(session, id);

      assert.equal(expense.status, 'PENDING');
      assert.equal(expense.kind, 'ONE_TIME');
      assert.equal(expense.amount, '100');
      assert.equal(expense.settledAmount, '0');
      assert.equal(expense.outstandingAmount, '100');
      assert.equal(expense.settledOn, null);
      assert.equal(expense.entryDate, dayFrom(0));
      assert.deepEqual(expense.payments, []);
      assert.deepEqual(
        expense.history.map(({ type }: { type: string }) => type),
        ['CREATED']
      );
      assert.equal(await prismaClient.expensePayment.count(), 0);
    });

    it('refuses invalid input field by field', async () => {
      const session = await signIn();

      const cases: Array<[object, string]> = [
        [{ description: '' }, 'description'],
        [{ amount: '0' }, 'amount'],
        [{ amount: '10.001' }, 'amount'],
        [{ amount: '-5' }, 'amount'],
        [{ dueDate: '2026-02-30' }, 'dueDate'],
        [{ category: 'PETS' }, 'category'],
        [{ currency: 'REAL' }, 'currency']
      ];

      for (const [overrides, path] of cases) {
        const res = await session.post(EXPENSES_ROUTE, {
          ...EXPENSE,
          ...overrides
        });

        assert.equal(res.status, Errors.VALIDATION.status, path);
        assert.ok(
          res.body.details.some(
            (detail: { path: string }) => detail.path === path
          ),
          JSON.stringify(res.body)
        );
      }

      assert.equal(await prismaClient.expense.count(), 0);
    });

    it('accepts no more decimal places than the currency has', async () => {
      const session = await signIn();

      const yen = await session.post(EXPENSES_ROUTE, {
        ...EXPENSE,
        currency: 'JPY',
        amount: '100.5'
      });
      const dinar = await session.post(EXPENSES_ROUTE, {
        ...EXPENSE,
        currency: 'KWD',
        amount: '100.125'
      });

      assert.equal(yen.status, Errors.VALIDATION.status);
      assert.equal(dinar.status, 201);
    });

    it('derives overdue from the reference day, which may differ from the server day by one', async () => {
      const session = await signIn();
      const id = await createExpense(session, { dueDate: dayFrom(-1) });

      const today = await session.get(expenseRoute(id));
      const dayBefore = await session.get(expenseRoute(id), {
        today: dayFrom(-1)
      });
      const tooFar = await session.get(expenseRoute(id), {
        today: dayFrom(-3)
      });

      assert.equal(today.body.status, 'OVERDUE');
      assert.equal(dayBefore.body.status, 'PENDING');
      assert.equal(tooFar.status, Errors.VALIDATION.status);
      assert.equal(
        tooFar.body.message,
        FinanceMessages.REFERENCE_DAY_OUT_OF_RANGE
      );
    });

    it('lists with filters, search, an amount range and sorting', async () => {
      const session = await signIn();
      await createExpense(session, {
        description: 'Rent',
        category: 'HOUSING',
        amount: '1500',
        dueDate: dayFrom(-2)
      });
      await createExpense(session, { description: 'Water', amount: '80' });
      const paid = await createExpense(session, {
        description: 'Internet',
        amount: '120',
        dueDate: dayFrom(5)
      });
      await pay(session, paid, { amount: '120' });

      const overdue = await session.get(EXPENSES_ROUTE, { status: 'OVERDUE' });
      const settled = await session.get(EXPENSES_ROUTE, { status: 'PAID' });
      const open = await session.get(EXPENSES_ROUTE, { status: 'open' });
      const searched = await session.get(EXPENSES_ROUTE, { search: 'wat' });
      const byAmount = await session.get(EXPENSES_ROUTE, {
        sortBy: 'amount',
        sortOrder: 'desc'
      });
      const housing = await session.get(EXPENSES_ROUTE, {
        category: 'HOUSING'
      });
      const midRange = await session.get(EXPENSES_ROUTE, {
        minAmount: '80',
        maxAmount: '120.00'
      });
      const invalidRange = await session.get(EXPENSES_ROUTE, {
        minAmount: '-1'
      });

      const descriptions = (res: { body: { items: Array<object> } }) =>
        res.body.items.map(
          (item) => (item as { description: string }).description
        );

      assert.deepEqual(descriptions(overdue), ['Rent']);
      assert.deepEqual(descriptions(settled), ['Internet']);
      assert.deepEqual(descriptions(open), ['Rent', 'Water']);
      assert.deepEqual(descriptions(searched), ['Water']);
      assert.deepEqual(descriptions(byAmount), ['Rent', 'Internet', 'Water']);
      assert.deepEqual(descriptions(housing), ['Rent']);
      assert.deepEqual(descriptions(midRange), ['Internet', 'Water']);
      assert.equal(invalidRange.status, Errors.VALIDATION.status);
      assert.equal(byAmount.body.total, 3);
    });

    it("answers another user's expense as missing and never lists it", async () => {
      const owner = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      const id = await createExpense(owner);

      const responses = await Promise.all([
        intruder.get(expenseRoute(id)),
        intruder.patch(expenseRoute(id), { amount: '1' }),
        intruder.remove(expenseRoute(id)),
        intruder.post(paymentsRoute(id), PAYMENT)
      ]);
      const listed = await intruder.get(EXPENSES_ROUTE);

      for (const res of responses)
        assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(listed.body.total, 0);
      assert.equal((await readExpense(owner, id)).amount, '100');
    });

    it('answers a missing expense as not found', async () => {
      const session = await signIn();

      const res = await session.get(expenseRoute(MISSING_UUID));

      assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(res.body.message, FinanceMessages.EXPENSE_NOT_FOUND);
    });

    it('records each changed field in the history and ignores an equal value', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      await session.patch(expenseRoute(id), {
        amount: '100.00',
        description: 'Power'
      });
      const expense = await readExpense(session, id);

      assert.equal(expense.description, 'Power');
      assert.deepEqual(expense.history[0].changes, {
        description: { from: 'Electricity', to: 'Power' }
      });
    });

    it('cancels and restores an expense without payments, and deletes it', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      const cancelled = await session.patch(expenseRoute(id), {
        cancelled: true
      });
      const afterCancel = await readExpense(session, id);
      await session.patch(expenseRoute(id), { cancelled: false });
      const afterRestore = await readExpense(session, id);
      const deleted = await session.remove(expenseRoute(id));

      assert.equal(cancelled.status, 200);
      assert.equal(afterCancel.status, 'CANCELLED');
      assert.equal(afterRestore.status, 'PENDING');
      assert.equal(deleted.status, 200);
      assert.equal(await prismaClient.expense.count(), 0);
      assert.equal(await prismaClient.financeEvent.count(), 0);
    });
  });

  describe('payments', () => {
    it('settles in parts, and is paid on the day of the payment that completes it', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      await pay(session, id, { amount: '40', paidOn: dayFrom(-3) });
      const partly = await readExpense(session, id);
      await pay(session, id, { amount: '60', paidOn: dayFrom(-1) });
      const paid = await readExpense(session, id);
      const again = await session.post(paymentsRoute(id), PAYMENT);

      assert.equal(partly.status, 'PENDING');
      assert.equal(partly.settledAmount, '40');
      assert.equal(partly.outstandingAmount, '60');
      assert.equal(paid.status, 'PAID');
      assert.equal(paid.settledOn, dayFrom(-1));
      assert.equal(paid.outstandingAmount, '0');
      assert.equal(again.status, Errors.CONFLICT.status);
      assert.equal(again.body.message, FinanceMessages.ALREADY_SETTLED);
    });

    it('refuses a payment beyond what is owed and stores nothing', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      const res = await session.post(paymentsRoute(id), {
        amount: '100.01',
        paidOn: dayFrom(0)
      });

      assert.equal(res.status, Errors.DOMAIN.status);
      assert.equal(
        res.body.message,
        FinanceMessages.PAYMENT_EXCEEDS_OUTSTANDING
      );
      assert.equal(await prismaClient.expensePayment.count(), 0);
      assert.equal((await readExpense(session, id)).settledAmount, '0');
    });

    it('settles with a discount and keeps fees apart from what they settle', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      await pay(session, id, { amount: '90', discount: '10', fees: '2.50' });
      const expense = await readExpense(session, id);

      assert.equal(expense.status, 'PAID');
      assert.deepEqual(
        {
          amount: expense.payments[0].amount,
          discount: expense.payments[0].discount,
          fees: expense.payments[0].fees
        },
        { amount: '90', discount: '10', fees: '2.5' }
      );
    });

    it('refuses an empty payment, a future payment day and a precision the currency lacks', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      const empty = await session.post(paymentsRoute(id), {
        amount: '0',
        paidOn: dayFrom(0)
      });
      const future = await session.post(paymentsRoute(id), {
        ...PAYMENT,
        paidOn: dayFrom(5)
      });
      const imprecise = await session.post(paymentsRoute(id), {
        ...PAYMENT,
        fees: '0.001'
      });

      assert.equal(empty.status, Errors.VALIDATION.status);
      assert.equal(future.status, Errors.VALIDATION.status);
      assert.equal(imprecise.status, Errors.VALIDATION.status);
      assert.deepEqual(imprecise.body.details, [
        { path: 'fees', message: FinanceMessages.AMOUNT_PRECISION }
      ]);
      assert.equal(await prismaClient.expensePayment.count(), 0);
    });

    it('corrects a payment, resettles the expense and keeps the previous values', async () => {
      const session = await signIn();
      const id = await createExpense(session);
      const paymentId = await pay(session, id, { amount: '100' });

      const res = await session.patch(paymentRoute(id, paymentId), {
        amount: '70'
      });
      const expense = await readExpense(session, id);

      assert.equal(res.status, 200);
      assert.equal(expense.status, 'PENDING');
      assert.equal(expense.settledAmount, '70');
      assert.equal(expense.history[0].type, 'PAYMENT_CORRECTED');
      assert.deepEqual(expense.history[0].changes, {
        paymentId,
        amount: { from: '100', to: '70' }
      });
    });

    it('refuses a correction that would settle more than the amount', async () => {
      const session = await signIn();
      const id = await createExpense(session);
      await pay(session, id, { amount: '60' });
      const paymentId = await pay(session, id, { amount: '30' });

      const res = await session.patch(paymentRoute(id, paymentId), {
        amount: '50'
      });

      assert.equal(res.status, Errors.DOMAIN.status);
      assert.equal((await readExpense(session, id)).settledAmount, '90');
    });

    it('voids a payment, which then settles nothing and can no longer be corrected', async () => {
      const session = await signIn();
      const id = await createExpense(session);
      const paymentId = await pay(session, id, { amount: '100' });

      const voided = await session.remove(paymentRoute(id, paymentId));
      const expense = await readExpense(session, id);
      const corrected = await session.patch(paymentRoute(id, paymentId), {
        amount: '10'
      });
      const active = await session.get(PAYMENTS_ROUTE);
      const all = await session.get(PAYMENTS_ROUTE, { includeVoided: 'true' });

      assert.equal(voided.status, 200);
      assert.equal(expense.status, 'PENDING');
      assert.equal(expense.settledAmount, '0');
      assert.notEqual(expense.payments[0].voidedAt, null);
      assert.equal(expense.history[0].type, 'PAYMENT_VOIDED');
      assert.equal(corrected.status, Errors.NOT_FOUND.status);
      assert.equal(active.body.total, 0);
      assert.equal(all.body.total, 1);
      assert.equal(all.body.items[0].description, 'Electricity');
    });

    it('keeps an expense with payments from being cancelled, deleted or reduced below them', async () => {
      const session = await signIn();
      const id = await createExpense(session);
      await pay(session, id, { amount: '60' });

      const cancelled = await session.patch(expenseRoute(id), {
        cancelled: true
      });
      const deleted = await session.remove(expenseRoute(id));
      const reduced = await session.patch(expenseRoute(id), { amount: '50' });
      const raised = await session.patch(expenseRoute(id), { amount: '60' });

      assert.equal(cancelled.status, Errors.CONFLICT.status);
      assert.equal(deleted.status, Errors.CONFLICT.status);
      assert.equal(reduced.status, Errors.DOMAIN.status);
      assert.equal(reduced.body.message, FinanceMessages.AMOUNT_BELOW_SETTLED);
      assert.equal(raised.status, 200);
      assert.equal((await readExpense(session, id)).status, 'PAID');
    });

    it('refuses a payment on a cancelled expense', async () => {
      const session = await signIn();
      const id = await createExpense(session);
      await session.patch(expenseRoute(id), { cancelled: true });

      const res = await session.post(paymentsRoute(id), PAYMENT);

      assert.equal(res.status, Errors.CONFLICT.status);
      assert.equal(res.body.message, FinanceMessages.EXPENSE_CANCELLED);
    });

    it('records each of two concurrent payments once, never beyond the amount', async () => {
      const session = await signIn();
      const id = await createExpense(session);

      const responses = await Promise.all([
        session.post(paymentsRoute(id), { ...PAYMENT, amount: '70' }),
        session.post(paymentsRoute(id), { ...PAYMENT, amount: '70' })
      ]);

      assert.deepEqual(responses.map(({ status }) => status).toSorted(), [
        201,
        Errors.DOMAIN.status
      ]);
      assert.equal((await readExpense(session, id)).settledAmount, '70');
      assert.equal(await prismaClient.expensePayment.count(), 1);
    });

    it('rolls back a payment when settling the expense fails', async (t) => {
      const session = await signIn();
      const id = await createExpense(session);
      injectWriteFailure(t, 'expense', 'update');
      t.mock.method(console, 'error', () => undefined);

      const res = await session.post(paymentsRoute(id), PAYMENT);

      assert.equal(res.status, Errors.INTERNAL.status);
      assert.equal(await prismaClient.expensePayment.count(), 0);
      assert.equal(
        await prismaClient.financeEvent.count({
          where: { type: 'PAYMENT_RECORDED' }
        }),
        0
      );
    });
  });

  const PLAN = {
    description: 'Laptop',
    category: 'SHOPPING',
    currency: 'BRL',
    totalAmount: '1000.00',
    installmentCount: 3,
    firstDueDate: planDay('01-31')
  };

  const createPlan = async (session: Session, overrides: object = {}) => {
    const res = await session.post(PLANS_ROUTE, { ...PLAN, ...overrides });

    assert.equal(res.status, 201, JSON.stringify(res.body));

    return res.body.id as string;
  };

  const readPlan = async (session: Session, id: string) => {
    const res = await session.get(planRoute(id));

    assert.equal(res.status, 200, JSON.stringify(res.body));

    return res.body;
  };

  const installmentsOf = (plan: {
    installments: Array<Record<string, unknown>>;
  }) =>
    plan.installments.map(({ installmentNumber, dueDate, amount }) => ({
      installmentNumber,
      dueDate,
      amount
    }));

  describe('installment plans', () => {
    it('splits the total exactly, the first installment taking the remainder, monthly on the last day of shorter months', async () => {
      const session = await signIn();

      const id = await createPlan(session);
      const plan = await readPlan(session, id);

      assert.deepEqual(installmentsOf(plan), [
        { installmentNumber: 1, dueDate: planDay('01-31'), amount: '333.34' },
        { installmentNumber: 2, dueDate: planDay('02-28'), amount: '333.33' },
        { installmentNumber: 3, dueDate: planDay('03-31'), amount: '333.33' }
      ]);
      assert.equal(plan.status, 'ACTIVE');
      assert.equal(plan.totalAmount, '1000');
      assert.equal(plan.outstandingAmount, '1000');
      assert.equal(plan.installmentCount, 3);
      assert.equal(plan.remainingInstallments, 3);
      assert.equal(plan.nextDueDate, planDay('01-31'));
      assert.equal(plan.lastDueDate, planDay('03-31'));
      assert.ok(
        plan.installments.every(
          (installment: { status: string; installmentCount: number }) =>
            installment.status === 'PENDING' &&
            installment.installmentCount === 3
        )
      );
    });

    it('falls on 29 February in a leap year', async () => {
      const session = await signIn();

      const id = await createPlan(session, {
        firstDueDate: `${LEAP_YEAR}-01-31`,
        installmentCount: 2
      });

      assert.deepEqual(
        installmentsOf(await readPlan(session, id)).map(
          ({ dueDate }) => dueDate
        ),
        [`${LEAP_YEAR}-01-31`, `${LEAP_YEAR}-02-29`]
      );
    });

    it('falls due weekly or yearly when that is the frequency, and reschedules at it', async () => {
      const session = await signIn();

      const weekly = await createPlan(session, {
        frequency: 'weekly',
        firstDueDate: planDay('01-31')
      });
      const yearly = await createPlan(session, {
        frequency: 'YEARLY',
        firstDueDate: `${LEAP_YEAR}-02-29`,
        installmentCount: 2
      });
      const monthly = await readPlan(session, await createPlan(session));
      const [first] = (await readPlan(session, weekly)).installments;
      await pay(session, first.id, { amount: first.amount });
      const rescheduled = await session.post(
        `${planRoute(weekly)}/reschedule`,
        {
          remainingAmount: '600.00',
          remainingCount: 2,
          nextDueDate: planDay('02-10')
        }
      );
      const invalid = await session.post(PLANS_ROUTE, {
        ...PLAN,
        frequency: 'DAILY'
      });
      const weeklyPlan = await readPlan(session, weekly);

      assert.equal(rescheduled.status, 200, JSON.stringify(rescheduled.body));
      assert.equal(weeklyPlan.frequency, 'WEEKLY');
      assert.deepEqual(installmentsOf(weeklyPlan), [
        { installmentNumber: 1, dueDate: planDay('01-31'), amount: '333.34' },
        { installmentNumber: 2, dueDate: planDay('02-10'), amount: '300' },
        { installmentNumber: 3, dueDate: planDay('02-17'), amount: '300' }
      ]);
      assert.deepEqual(
        installmentsOf(await readPlan(session, yearly)).map(
          ({ dueDate }) => dueDate
        ),
        [`${LEAP_YEAR}-02-29`, `${LEAP_YEAR + 1}-02-28`]
      );
      assert.equal(monthly.frequency, 'MONTHLY');
      assert.equal(invalid.status, Errors.VALIDATION.status);
    });

    it('repeats a given installment amount and reports the financing cost over the cash price', async () => {
      const session = await signIn();

      const id = await createPlan(session, {
        totalAmount: undefined,
        installmentAmount: '50.00',
        installmentCount: 4,
        principalAmount: '180'
      });
      const plan = await readPlan(session, id);

      assert.equal(plan.totalAmount, '200');
      assert.equal(plan.financingCost, '20');
      assert.ok(
        plan.installments.every(
          ({ amount }: { amount: string }) => amount === '50'
        )
      );
    });

    it('refuses both amounts or neither, and a total too small to split', async () => {
      const session = await signIn();

      const both = await session.post(PLANS_ROUTE, {
        ...PLAN,
        installmentAmount: '10'
      });
      const neither = await session.post(PLANS_ROUTE, {
        ...PLAN,
        totalAmount: undefined
      });
      const tooSmall = await session.post(PLANS_ROUTE, {
        ...PLAN,
        totalAmount: '0.02'
      });

      assert.equal(both.status, Errors.VALIDATION.status);
      assert.equal(neither.status, Errors.VALIDATION.status);
      assert.equal(tooSmall.status, Errors.DOMAIN.status);
      assert.equal(
        tooSmall.body.message,
        FinanceMessages.INSTALLMENT_SPLIT_TOO_SMALL
      );
      assert.equal(await prismaClient.installmentPlan.count(), 0);
      assert.equal(await prismaClient.expense.count(), 0);
    });

    it('lists the installments as expenses numbered "n of N" and completes once all are paid', async () => {
      const session = await signIn();
      const id = await createPlan(session, {
        totalAmount: '30',
        installmentCount: 2
      });

      const listed = await session.get(EXPENSES_ROUTE, {
        installmentPlanId: id
      });
      for (const installment of listed.body.items)
        await pay(session, installment.id, { amount: installment.amount });
      const plan = await readPlan(session, id);
      const completed = await session.get(PLANS_ROUTE, {
        status: 'COMPLETED'
      });

      assert.deepEqual(
        listed.body.items.map(
          ({
            kind,
            installmentNumber,
            installmentCount
          }: Record<string, unknown>) => [
            kind,
            installmentNumber,
            installmentCount
          ]
        ),
        [
          ['INSTALLMENT', 1, 2],
          ['INSTALLMENT', 2, 2]
        ]
      );
      assert.equal(plan.status, 'COMPLETED');
      assert.equal(plan.paidInstallments, 2);
      assert.equal(plan.nextDueDate, null);
      assert.equal(completed.body.total, 1);
    });

    it('hands descriptive edits to the open installments not edited on their own', async () => {
      const session = await signIn();
      const id = await createPlan(session);
      const [first, second, third] = (await readPlan(session, id)).installments;
      await pay(session, first.id, { amount: first.amount });
      await session.patch(expenseRoute(second.id), { notes: 'own note' });

      await session.patch(planRoute(id), { description: 'Notebook' });
      const plan = await readPlan(session, id);

      assert.equal(plan.description, 'Notebook');
      assert.deepEqual(
        plan.installments.map(
          ({ description }: { description: string }) => description
        ),
        ['Laptop', 'Laptop', 'Notebook']
      );
      assert.equal(plan.installments[1].isCustomized, true);
      assert.equal(third.isCustomized, false);
      assert.equal(plan.history[0].type, 'UPDATED');
    });

    it('reschedules what is left after the last paid installment, keeping the paid one and the history', async () => {
      const session = await signIn();
      const id = await createPlan(session);
      const [first] = (await readPlan(session, id)).installments;
      await pay(session, first.id, { amount: first.amount });

      const res = await session.post(`${planRoute(id)}/reschedule`, {
        remainingAmount: '700.00',
        remainingCount: 3,
        nextDueDate: planDay('03-15')
      });
      const plan = await readPlan(session, id);

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(installmentsOf(plan), [
        { installmentNumber: 1, dueDate: planDay('01-31'), amount: '333.34' },
        { installmentNumber: 2, dueDate: planDay('03-15'), amount: '233.34' },
        { installmentNumber: 3, dueDate: planDay('04-15'), amount: '233.33' },
        { installmentNumber: 4, dueDate: planDay('05-15'), amount: '233.33' }
      ]);
      assert.equal(plan.keptThroughInstallment, 1);
      assert.equal(plan.totalAmount, '1033.34');
      assert.equal(plan.installments[0].status, 'PAID');
      assert.equal(plan.history[0].type, 'RESCHEDULED');
      assert.deepEqual(
        plan.history[0].changes.replaced.map(
          ({ installmentNumber }: { installmentNumber: number }) =>
            installmentNumber
        ),
        [2, 3]
      );
    });

    it('keeps an installment whose only payment was voided through a reschedule', async () => {
      const session = await signIn();
      const id = await createPlan(session);
      const unpaid = await readPlan(session, id);
      const [, second] = unpaid.installments;
      const paymentId = await pay(session, second.id, { amount: '10' });
      await session.remove(paymentRoute(second.id, paymentId));

      const voided = await readPlan(session, id);
      const res = await session.post(`${planRoute(id)}/reschedule`, {
        remainingAmount: '300',
        remainingCount: 1,
        nextDueDate: planDay('04-30')
      });
      const plan = await readPlan(session, id);

      assert.equal(unpaid.keptThroughInstallment, null);
      assert.equal(voided.keptThroughInstallment, 2);
      assert.equal(voided.installments[1].settledAmount, '0');
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(
        installmentsOf(plan).map(({ installmentNumber }) => installmentNumber),
        [1, 2, 3]
      );
      assert.equal(plan.installments[1].id, second.id);
    });

    it('refuses a reschedule due before the last installment it keeps', async () => {
      const session = await signIn();
      const id = await createPlan(session);
      const [first] = (await readPlan(session, id)).installments;
      await pay(session, first.id, { amount: '10' });

      const res = await session.post(`${planRoute(id)}/reschedule`, {
        remainingAmount: '600',
        remainingCount: 2,
        nextDueDate: planDay('01-15')
      });

      assert.equal(res.status, Errors.DOMAIN.status);
      assert.equal((await readPlan(session, id)).installmentCount, 3);
    });

    it('cancels the unpaid installments, keeps the partly paid one owed, and refuses restoring one', async () => {
      const session = await signIn();
      const id = await createPlan(session);
      const [first, second] = (await readPlan(session, id)).installments;
      await pay(session, first.id, { amount: '100' });

      const res = await session.post(`${planRoute(id)}/cancel`);
      const plan = await readPlan(session, id);
      const restored = await session.patch(expenseRoute(second.id), {
        cancelled: false
      });
      const again = await session.post(`${planRoute(id)}/cancel`);
      const rescheduled = await session.post(`${planRoute(id)}/reschedule`, {
        remainingAmount: '10',
        remainingCount: 1,
        nextDueDate: planDay('06-01')
      });

      assert.equal(res.status, 200);
      assert.equal(plan.status, 'CANCELLED');
      assert.deepEqual(
        plan.installments.map(({ status }: { status: string }) => status),
        ['PENDING', 'CANCELLED', 'CANCELLED']
      );
      assert.equal(plan.totalAmount, '333.34');
      assert.equal(restored.status, Errors.CONFLICT.status);
      assert.equal(
        restored.body.message,
        FinanceMessages.EXPENSE_ORIGIN_CANCELLED
      );
      assert.equal(again.status, Errors.CONFLICT.status);
      assert.equal(rescheduled.status, Errors.CONFLICT.status);
    });

    it('deletes a plan without payments, and refuses one with an active payment', async () => {
      const session = await signIn();
      const unpaid = await createPlan(session);
      const paid = await createPlan(session);
      const [first] = (await readPlan(session, paid)).installments;
      await pay(session, first.id, { amount: '10' });

      const deleted = await session.remove(planRoute(unpaid));
      const refused = await session.remove(planRoute(paid));
      const direct = await session.remove(expenseRoute(first.id));

      assert.equal(deleted.status, 200);
      assert.equal(refused.status, Errors.CONFLICT.status);
      assert.equal(refused.body.message, FinanceMessages.PLAN_HAS_PAYMENTS);
      assert.equal(direct.status, Errors.DOMAIN.status);
      assert.equal(
        await prismaClient.expense.count({
          where: { installmentPlanId: unpaid }
        }),
        0
      );
      assert.equal(
        await prismaClient.financeEvent.count({ where: { recordId: unpaid } }),
        0
      );
    });

    it("answers another user's plan as missing", async () => {
      const owner = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      const id = await createPlan(owner);

      const responses = await Promise.all([
        intruder.get(planRoute(id)),
        intruder.patch(planRoute(id), { description: 'Mine' }),
        intruder.post(`${planRoute(id)}/cancel`),
        intruder.remove(planRoute(id))
      ]);

      for (const res of responses)
        assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal((await readPlan(owner, id)).status, 'ACTIVE');
    });

    it('creates no plan when writing its installments fails', async (t) => {
      const session = await signIn();
      injectWriteFailure(t, 'expense', 'createMany');
      t.mock.method(console, 'error', () => undefined);

      const res = await session.post(PLANS_ROUTE, PLAN);

      assert.equal(res.status, Errors.INTERNAL.status);
      assert.equal(await prismaClient.installmentPlan.count(), 0);
    });
  });

  const monthsFrom = (months: number) =>
    formatCalendarDay(addMonths(TODAY, months));

  const SERIES = {
    description: 'Gym',
    category: 'HEALTH',
    amount: '100.00',
    currency: 'BRL',
    frequency: 'MONTHLY',
    startDate: dayFrom(0)
  };

  /**
   * Weekly, so exactly one occurrence falls before the current day and the next
   * on it: a monthly series started a month back would anchor on a shorter
   * month's end and put a second one before the 29th to 31st.
   */
  const ONE_PAST_OCCURRENCE = { frequency: 'WEEKLY', startDate: dayFrom(-7) };

  const createSeries = async (session: Session, overrides: object = {}) => {
    const res = await session.post(SERIES_ROUTE, { ...SERIES, ...overrides });

    assert.equal(res.status, 201, JSON.stringify(res.body));

    return res.body.id as string;
  };

  const occurrencesOf = async (session: Session, id: string) => {
    const res = await session.get(EXPENSES_ROUTE, {
      recurringExpenseId: id,
      pageSize: '100'
    });

    assert.equal(res.status, 200, JSON.stringify(res.body));

    return res.body.items as Array<{
      id: string;
      amount: string;
      dueDate: string;
      occurrenceDate: string;
      status: string;
      kind: string;
    }>;
  };

  describe('recurring expenses', () => {
    it('generates the occurrences a year ahead, each owing the amount', async () => {
      const session = await signIn();

      const id = await createSeries(session);
      const occurrences = await occurrencesOf(session, id);
      const series = await session.get(seriesRoute(id));

      assert.equal(occurrences.length, 13);
      assert.equal(occurrences[0].dueDate, dayFrom(0));
      assert.equal(occurrences.at(-1)?.dueDate, monthsFrom(12));
      assert.ok(
        occurrences.every(
          ({ kind, status, amount }) =>
            kind === 'RECURRING' && status === 'PENDING' && amount === '100'
        )
      );
      assert.equal(series.body.status, 'ACTIVE');
      assert.equal(series.body.nextDueDate, dayFrom(0));
      assert.equal(series.body.monthlyEquivalent, '100');
      assert.equal(await prismaClient.expensePayment.count(), 0);
    });

    it('repeats a weekly series every seven days and averages it per month', async () => {
      const session = await signIn();

      const id = await createSeries(session, {
        frequency: 'WEEKLY',
        amount: '30',
        endDate: dayFrom(21)
      });
      const occurrences = await occurrencesOf(session, id);
      const series = await session.get(seriesRoute(id));

      assert.deepEqual(
        occurrences.map(({ dueDate }) => dueDate),
        [dayFrom(0), dayFrom(7), dayFrom(14), dayFrom(21)]
      );
      assert.equal(series.body.monthlyEquivalent, '130');
    });

    it('refuses a start more than a year back and an end before the start', async () => {
      const session = await signIn();

      const old = await session.post(SERIES_ROUTE, {
        ...SERIES,
        startDate: monthsFrom(-13)
      });
      const reversed = await session.post(SERIES_ROUTE, {
        ...SERIES,
        endDate: dayFrom(-1)
      });

      assert.equal(old.status, Errors.VALIDATION.status);
      assert.equal(reversed.status, Errors.VALIDATION.status);
      assert.equal(await prismaClient.recurringExpense.count(), 0);
    });

    it('generates missing occurrences on read once, however many reads run at the same time', async () => {
      const session = await signIn();
      const id = await createSeries(session);
      await prismaClient.expense.deleteMany({
        where: {
          recurringExpenseId: id,
          occurrenceDate: { gt: addMonths(TODAY, 3) }
        }
      });
      await prismaClient.recurringExpense.update({
        where: { id },
        data: { generatedThrough: addMonths(TODAY, 1) }
      });

      await Promise.all([
        session.get(EXPENSES_ROUTE),
        session.get(SUMMARY_ROUTE),
        session.get(ALERTS_ROUTE)
      ]);
      const occurrences = await occurrencesOf(session, id);

      assert.equal(occurrences.length, 13);
      assert.equal(
        new Set(occurrences.map(({ occurrenceDate }) => occurrenceDate)).size,
        13
      );
    });

    it('applies an edit from its effective day to the occurrences not paid or edited on their own', async () => {
      const session = await signIn();
      const id = await createSeries(session, { startDate: monthsFrom(-2) });
      const [first, second, , fourth] = await occurrencesOf(session, id);
      await pay(session, first.id, { amount: '100' });
      await session.patch(expenseRoute(fourth.id), { amount: '90' });

      const res = await session.patch(seriesRoute(id), {
        amount: '120',
        effectiveFrom: second.dueDate
      });
      const amounts = (await occurrencesOf(session, id)).map(
        ({ amount }) => amount
      );
      const series = await session.get(seriesRoute(id));

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(amounts.slice(0, 5), ['100', '120', '120', '90', '120']);
      assert.ok(amounts.slice(4).every((amount) => amount === '120'));
      assert.equal(series.body.amount, '120');
      assert.deepEqual(series.body.history[0].changes.amount, {
        from: '100',
        to: '120'
      });
    });

    it('applies an edit from the current day by default', async () => {
      const session = await signIn();
      const id = await createSeries(session, ONE_PAST_OCCURRENCE);

      await session.patch(seriesRoute(id), { amount: '110' });
      const amounts = (await occurrencesOf(session, id)).map(
        ({ amount }) => amount
      );

      assert.equal(amounts[0], '100');
      assert.ok(amounts.slice(1).every((amount) => amount === '110'));
    });

    it('removes the occurrences after an earlier end date, unless one of them has a payment', async () => {
      const session = await signIn();
      const id = await createSeries(session);
      const occurrences = await occurrencesOf(session, id);
      await pay(session, occurrences[6].id, { amount: '10' });

      const blocked = await session.patch(seriesRoute(id), {
        endDate: monthsFrom(3)
      });
      const shortened = await session.patch(seriesRoute(id), {
        endDate: monthsFrom(8)
      });
      const before = await session.patch(seriesRoute(id), {
        endDate: dayFrom(-1)
      });
      const remaining = await occurrencesOf(session, id);
      const extended = await session.patch(seriesRoute(id), { endDate: null });

      assert.equal(blocked.status, Errors.CONFLICT.status);
      assert.equal(
        blocked.body.message,
        FinanceMessages.END_BEFORE_PAID_OCCURRENCE
      );
      assert.equal(shortened.status, 200);
      assert.equal(before.status, Errors.VALIDATION.status);
      assert.equal(remaining.length, 9);
      assert.equal(extended.status, 200);
      assert.equal((await occurrencesOf(session, id)).length, 13);
    });

    it('cancels from the current day, keeping earlier and paid occurrences and the history', async () => {
      const session = await signIn();
      const id = await createSeries(session, ONE_PAST_OCCURRENCE);
      const occurrences = await occurrencesOf(session, id);
      const paymentId = await pay(session, occurrences[3].id, {
        amount: '10'
      });
      await session.remove(paymentRoute(occurrences[3].id, paymentId));
      await pay(session, occurrences[4].id, { amount: '10' });

      const res = await session.post(`${seriesRoute(id)}/cancel`);
      const remaining = await occurrencesOf(session, id);
      const series = await session.get(seriesRoute(id));
      const edited = await session.patch(seriesRoute(id), { amount: '1' });

      assert.equal(res.status, 200);
      assert.deepEqual(
        remaining.map(({ dueDate, status }) => [dueDate, status]),
        [
          [occurrences[0].dueDate, 'OVERDUE'],
          [occurrences[3].dueDate, 'CANCELLED'],
          [occurrences[4].dueDate, 'PENDING']
        ]
      );
      assert.equal(series.body.status, 'CANCELLED');
      assert.equal(series.body.nextDueDate, null);
      assert.equal(series.body.history[0].type, 'CANCELLED');
      assert.equal(edited.status, Errors.CONFLICT.status);
    });

    it('creates the occurrences before an edit or a stop on the terms before it, when generation lags behind', async () => {
      const session = await signIn();
      const lagging = async () => {
        const id = await createSeries(session);
        await prismaClient.expense.deleteMany({
          where: {
            recurringExpenseId: id,
            occurrenceDate: { gt: addMonths(TODAY, 3) }
          }
        });
        await prismaClient.recurringExpense.update({
          where: { id },
          data: { generatedThrough: addMonths(TODAY, 3) }
        });

        return id;
      };
      const edited = await lagging();
      const stopped = await lagging();

      const edit = await session.patch(seriesRoute(edited), {
        amount: '120',
        effectiveFrom: monthsFrom(6)
      });
      const stop = await session.post(`${seriesRoute(stopped)}/cancel`, {
        effectiveFrom: monthsFrom(6)
      });
      const editedAmounts = (await occurrencesOf(session, edited)).map(
        ({ amount }) => amount
      );
      const stoppedDays = (await occurrencesOf(session, stopped)).map(
        ({ dueDate }) => dueDate
      );

      assert.equal(edit.status, 200, JSON.stringify(edit.body));
      assert.deepEqual(editedAmounts, [
        ...Array<string>(6).fill('100'),
        ...Array<string>(7).fill('120')
      ]);
      assert.equal(stop.status, 200, JSON.stringify(stop.body));
      assert.deepEqual(
        stoppedDays,
        Array.from({ length: 6 }, (_, month) => monthsFrom(month))
      );
    });

    it('refuses an edit or a stop from after the occurrences created ahead, unless the series starts later', async () => {
      const session = await signIn();
      const id = await createSeries(session);
      const later = await createSeries(session, { startDate: monthsFrom(18) });

      const edit = await session.patch(seriesRoute(id), {
        amount: '120',
        effectiveFrom: monthsFrom(13)
      });
      const stop = await session.post(`${seriesRoute(id)}/cancel`, {
        effectiveFrom: monthsFrom(13)
      });
      const series = await session.get(seriesRoute(id));
      const laterEdit = await session.patch(seriesRoute(later), {
        amount: '120',
        effectiveFrom: monthsFrom(18)
      });

      for (const res of [edit, stop]) {
        assert.equal(res.status, Errors.VALIDATION.status);
        assert.deepEqual(
          res.body.details.map(({ path }: { path: string }) => path),
          ['effectiveFrom']
        );
      }
      assert.equal(series.body.status, 'ACTIVE');
      assert.equal(series.body.amount, '100');
      assert.equal(laterEdit.status, 200, JSON.stringify(laterEdit.body));
    });

    it('deletes a series without payments with its occurrences, and refuses one with a payment', async () => {
      const session = await signIn();
      const unpaid = await createSeries(session);
      const paid = await createSeries(session);
      const [first] = await occurrencesOf(session, paid);
      await pay(session, first.id, { amount: '10' });

      const deleted = await session.remove(seriesRoute(unpaid));
      const refused = await session.remove(seriesRoute(paid));
      const direct = await session.remove(expenseRoute(first.id));

      assert.equal(deleted.status, 200);
      assert.equal(refused.status, Errors.CONFLICT.status);
      assert.equal(direct.status, Errors.DOMAIN.status);
      assert.equal(
        await prismaClient.expense.count({
          where: { recurringExpenseId: unpaid }
        }),
        0
      );
    });

    it("answers another user's series as missing and generates nothing for the intruder", async () => {
      const owner = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      const id = await createSeries(owner);

      const responses = await Promise.all([
        intruder.get(seriesRoute(id)),
        intruder.patch(seriesRoute(id), { amount: '1' }),
        intruder.post(`${seriesRoute(id)}/cancel`),
        intruder.remove(seriesRoute(id))
      ]);
      const listed = await intruder.get(EXPENSES_ROUTE);

      for (const res of responses)
        assert.equal(res.status, Errors.NOT_FOUND.status);
      assert.equal(listed.body.total, 0);
    });
  });

  const MONTH = startOfMonth(TODAY);
  const monthDay = (months: number, days = 0) =>
    formatCalendarDay(addDays(addMonths(MONTH, months), days));
  const monthOf = (months: number) =>
    formatCalendarMonth(addMonths(MONTH, months));

  const FIRST_OF_MONTH = monthDay(0);
  const LAST_OF_MONTH = formatCalendarDay(endOfMonth(TODAY));
  const LAST_OF_PREVIOUS_MONTH = monthDay(0, -1);
  const FIRST_OF_NEXT_MONTH = monthDay(1);

  describe('summary', () => {
    it('separates what is overdue and due soon by currency, leaving out cancelled expenses', async () => {
      const session = await signIn();
      await createExpense(session, { amount: '100', dueDate: dayFrom(-5) });
      const dueSoon = await createExpense(session, {
        amount: '50',
        dueDate: dayFrom(2)
      });
      await pay(session, dueSoon, { amount: '20' });
      await createExpense(session, {
        amount: '70',
        currency: 'USD',
        dueDate: dayFrom(1)
      });
      await createExpense(session, { amount: '200', dueDate: dayFrom(30) });
      const cancelled = await createExpense(session, {
        amount: '10',
        dueDate: dayFrom(1)
      });
      await session.patch(expenseRoute(cancelled), { cancelled: true });

      const real = await session.get(SUMMARY_ROUTE);
      const dollar = await session.get(SUMMARY_ROUTE, { currency: 'USD' });

      assert.equal(real.status, 200, JSON.stringify(real.body));
      assert.equal(real.body.currency, 'BRL');
      assert.deepEqual(real.body.currencies, ['BRL', 'USD']);
      assert.equal(real.body.today, dayFrom(0));
      assert.equal(real.body.reminders.reminderLeadDays, 3);
      assert.deepEqual(real.body.overdue, { amount: '100', count: 1 });
      assert.deepEqual(real.body.dueSoon, { amount: '30', count: 1 });
      assert.deepEqual(dollar.body.overdue, { amount: '0', count: 0 });
      assert.deepEqual(dollar.body.dueSoon, { amount: '70', count: 1 });
      assert.ok(
        dollar.body.upcoming.every(
          ({ currency }: { currency: string }) => currency === 'USD'
        )
      );
    });

    it('totals what is still owed whenever due, leaving out recurring bills after the current month', async () => {
      const session = await signIn();
      const partly = await createExpense(session, {
        amount: '100',
        dueDate: dayFrom(-40)
      });
      await pay(session, partly, { amount: '30' });
      const settled = await createExpense(session, { amount: '50' });
      await pay(session, settled, { amount: '50' });
      const cancelled = await createExpense(session, { amount: '10' });
      await session.patch(expenseRoute(cancelled), { cancelled: true });
      await createExpense(session, { amount: '5', dueDate: dayFrom(400) });
      await createExpense(session, { amount: '9', currency: 'USD' });
      await createPlan(session);
      const series = await createSeries(session, { amount: '20' });
      const thisMonth = (await occurrencesOf(session, series)).filter(
        ({ dueDate }) => dueDate <= LAST_OF_MONTH
      );

      const res = await session.get(SUMMARY_ROUTE);

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body.outstanding, {
        amount: String(70 + 5 + 1000 + 20 * thisMonth.length),
        count: 2 + 3 + thisMonth.length
      });
    });

    it('sets the current month planned against paid, the months before it and the commitments ahead', async () => {
      const session = await signIn();
      const current = await createExpense(session, {
        amount: '300',
        dueDate: LAST_OF_MONTH
      });
      await pay(session, current, { amount: '100', fees: '5' });
      const previous = await createExpense(session, {
        amount: '80',
        dueDate: LAST_OF_PREVIOUS_MONTH
      });
      await pay(session, previous, {
        amount: '80',
        paidOn: LAST_OF_PREVIOUS_MONTH
      });
      await createExpense(session, {
        amount: '40',
        dueDate: FIRST_OF_NEXT_MONTH
      });
      await createPlan(session, {
        totalAmount: '300',
        installmentCount: 3,
        firstDueDate: FIRST_OF_NEXT_MONTH
      });
      await createSeries(session, {
        amount: '50',
        startDate: FIRST_OF_NEXT_MONTH
      });

      const res = await session.get(SUMMARY_ROUTE);
      const { body } = res;

      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.month, monthOf(0));
      assert.deepEqual(body.current, {
        scheduled: { amount: '300', count: 1 },
        paid: { amount: '105', count: 1 },
        settled: '100',
        outstanding: { amount: '200', count: 1 },
        overdue: { amount: '0', count: 0 },
        fees: '5',
        discounts: '0'
      });
      assert.deepEqual(body.change, {
        scheduled: { amount: '220', percent: '2.75' },
        paid: { amount: '25', percent: '0.3125' }
      });
      assert.deepEqual(body.overdue, { amount: '0', count: 0 });
      assert.equal(body.trend.length, 6);
      assert.deepEqual(body.trend.slice(-2), [
        {
          month: monthOf(-1),
          scheduled: '80',
          paid: '80',
          outstanding: '0',
          overdue: '0'
        },
        {
          month: monthOf(0),
          scheduled: '300',
          paid: '105',
          outstanding: '200',
          overdue: '0'
        }
      ]);
      assert.equal(body.commitments.length, 6);
      assert.deepEqual(body.commitments.slice(0, 2), [
        {
          month: monthOf(0),
          oneTime: '200',
          installments: '0',
          recurring: '0',
          total: '200'
        },
        {
          month: monthOf(1),
          oneTime: '40',
          installments: '100',
          recurring: '50',
          total: '190'
        }
      ]);
      assert.deepEqual(body.categories, [
        { category: 'UTILITIES', scheduled: '300', paid: '105', share: '1' }
      ]);
      assert.deepEqual(body.installments, {
        activePlans: 1,
        openInstallments: 3,
        outstanding: '300'
      });
      assert.equal(body.recurring.activeSeries, 1);
      assert.equal(body.recurring.monthlyEquivalent, '50');
      assert.equal(body.upcoming[0].id, current);
    });

    it('refuses an unsupported currency and shows nothing of another user', async () => {
      const owner = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      await createExpense(owner, { dueDate: dayFrom(-1) });

      const invalid = await owner.get(SUMMARY_ROUTE, { currency: 'REAL' });
      const res = await intruder.get(SUMMARY_ROUTE);

      assert.equal(invalid.status, Errors.VALIDATION.status);
      assert.deepEqual(res.body.currencies, []);
      assert.deepEqual(res.body.overdue, { amount: '0', count: 0 });
      assert.deepEqual(res.body.upcoming, []);
    });
  });

  describe('calendar', () => {
    it('lists the days of a month with expenses owed, with totals by currency', async () => {
      const session = await signIn();
      await createExpense(session, { amount: '100', dueDate: LAST_OF_MONTH });
      await createExpense(session, {
        amount: '20',
        currency: 'USD',
        dueDate: LAST_OF_MONTH
      });
      const cancelled = await createExpense(session, {
        amount: '5',
        dueDate: LAST_OF_MONTH
      });
      await session.patch(expenseRoute(cancelled), { cancelled: true });
      const paid = await createExpense(session, {
        amount: '30',
        dueDate: FIRST_OF_MONTH
      });
      await pay(session, paid, { amount: '30' });
      await createExpense(session, { dueDate: FIRST_OF_NEXT_MONTH });

      const all = await session.get(CALENDAR_ROUTE, { month: monthOf(0) });
      const dollar = await session.get(CALENDAR_ROUTE, {
        month: monthOf(0),
        currency: 'USD'
      });

      assert.equal(all.status, 200, JSON.stringify(all.body));
      assert.deepEqual(all.body, {
        month: monthOf(0),
        days: [
          {
            date: FIRST_OF_MONTH,
            count: 1,
            paidCount: 1,
            overdueCount: 0,
            totals: [{ currency: 'BRL', amount: '30', outstanding: '0' }]
          },
          {
            date: LAST_OF_MONTH,
            count: 2,
            paidCount: 0,
            overdueCount: 0,
            totals: [
              { currency: 'BRL', amount: '100', outstanding: '100' },
              { currency: 'USD', amount: '20', outstanding: '20' }
            ]
          }
        ]
      });
      assert.deepEqual(
        dollar.body.days.map(({ date }: { date: string }) => date),
        [LAST_OF_MONTH]
      );
    });

    it('counts the open expenses of past days as overdue', async () => {
      const session = await signIn();
      await createExpense(session, { dueDate: LAST_OF_PREVIOUS_MONTH });

      const res = await session.get(CALENDAR_ROUTE, { month: monthOf(-1) });

      assert.deepEqual(res.body.days, [
        {
          date: LAST_OF_PREVIOUS_MONTH,
          count: 1,
          paidCount: 0,
          overdueCount: 1,
          totals: [{ currency: 'BRL', amount: '100', outstanding: '100' }]
        }
      ]);
    });

    it('requires a valid month', async () => {
      const session = await signIn();

      const queries: Array<Record<string, string>> = [
        {},
        { month: '2026-13' },
        { month: '2026-1' }
      ];

      for (const query of queries) {
        const res = await session.get(CALENDAR_ROUTE, query);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(query)
        );
      }
    });
  });

  describe('reports', () => {
    it('totals a span of months and compares it with the span of equal length before it', async () => {
      const session = await signIn();
      await createExpense(session, { amount: '100', dueDate: LAST_OF_MONTH });
      const previous = await createExpense(session, {
        amount: '60',
        category: 'HOUSING',
        dueDate: LAST_OF_PREVIOUS_MONTH
      });
      await pay(session, previous, { amount: '30', fees: '2' });
      const earlier = await createExpense(session, {
        amount: '50',
        dueDate: monthDay(-2)
      });
      await pay(session, earlier, { amount: '50', paidOn: monthDay(-2) });
      await createExpense(session, {
        amount: '999',
        currency: 'USD',
        dueDate: LAST_OF_MONTH
      });

      const res = await session.get(REPORTS_ROUTE, {
        from: monthOf(-1),
        to: monthOf(0)
      });
      const { body } = res;

      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.currency, 'BRL');
      assert.deepEqual(body.currencies, ['BRL', 'USD']);
      assert.deepEqual(body.totals, {
        scheduled: { amount: '160', count: 2 },
        paid: { amount: '32', count: 1 },
        settled: '30',
        outstanding: { amount: '130', count: 2 },
        overdue: { amount: '30', count: 1 },
        fees: '2',
        discounts: '0'
      });
      assert.deepEqual(body.previous, {
        from: monthOf(-3),
        to: monthOf(-2),
        scheduled: '50',
        paid: '50'
      });
      assert.deepEqual(body.change, {
        scheduled: { amount: '110', percent: '2.2' },
        paid: { amount: '-18', percent: '-0.36' }
      });
      assert.deepEqual(body.months, [
        {
          month: monthOf(-1),
          scheduled: '60',
          paid: '0',
          outstanding: '30',
          overdue: '30'
        },
        {
          month: monthOf(0),
          scheduled: '100',
          paid: '32',
          outstanding: '100',
          overdue: '0'
        }
      ]);
      assert.deepEqual(body.categories, [
        { category: 'UTILITIES', scheduled: '100', paid: '0', share: '0.625' },
        { category: 'HOUSING', scheduled: '60', paid: '32', share: '0.375' }
      ]);
      assert.deepEqual(body.kinds, [
        { kind: 'ONE_TIME', scheduled: '160', paid: '32' },
        { kind: 'INSTALLMENT', scheduled: '0', paid: '0' },
        { kind: 'RECURRING', scheduled: '0', paid: '0' }
      ]);
    });

    it('refuses a span that ends before it starts or exceeds 24 months', async () => {
      const session = await signIn();

      const reversed = await session.get(REPORTS_ROUTE, {
        from: monthOf(0),
        to: monthOf(-1)
      });
      const long = await session.get(REPORTS_ROUTE, {
        from: monthOf(-24),
        to: monthOf(0)
      });
      const longest = await session.get(REPORTS_ROUTE, {
        from: monthOf(-23),
        to: monthOf(0)
      });

      assert.equal(reversed.status, Errors.VALIDATION.status);
      assert.equal(long.status, Errors.VALIDATION.status);
      assert.equal(longest.status, 200);
      assert.equal(longest.body.months.length, 24);
    });
  });

  describe('alerts and settings', () => {
    it('reminds of what is overdue and due within the lead days the user sets', async () => {
      const session = await signIn();
      await createExpense(session, { amount: '100', dueDate: dayFrom(-2) });
      await createExpense(session, {
        amount: '10',
        currency: 'USD',
        dueDate: dayFrom(-1)
      });
      const settled = await createExpense(session, {
        amount: '7',
        dueDate: dayFrom(-3)
      });
      await pay(session, settled, { amount: '7' });
      const soon = await createExpense(session, {
        amount: '30',
        dueDate: dayFrom(1)
      });
      const later = await createExpense(session, {
        amount: '20',
        dueDate: dayFrom(5)
      });
      await createExpense(session, { amount: '999', dueDate: dayFrom(10) });

      const defaults = await session.get(SETTINGS_ROUTE);
      const before = await session.get(ALERTS_ROUTE);
      const saved = await session.put(SETTINGS_ROUTE, {
        ...DEFAULT_SETTINGS,
        reminderLeadDays: 7
      });
      const after = await session.get(ALERTS_ROUTE);

      assert.deepEqual(defaults.body, DEFAULT_SETTINGS);
      assert.equal(before.status, 200, JSON.stringify(before.body));
      assert.equal(before.body.overdue.count, 2);
      assert.deepEqual(before.body.overdue.totals, [
        { currency: 'BRL', amount: '100' },
        { currency: 'USD', amount: '10' }
      ]);
      assert.deepEqual(
        before.body.dueSoon.items.map(({ id }: { id: string }) => id),
        [soon]
      );
      assert.deepEqual(saved.body, {
        settings: { ...DEFAULT_SETTINGS, reminderLeadDays: 7 },
        message: FinanceMessages.SETTINGS_UPDATED
      });
      assert.deepEqual(after.body.reminders, {
        ...DEFAULT_SETTINGS,
        reminderLeadDays: 7
      });
      assert.deepEqual(
        after.body.dueSoon.items.map(({ id }: { id: string }) => id),
        [soon, later]
      );
      assert.deepEqual(after.body.dueSoon.totals, [
        { currency: 'BRL', amount: '50' }
      ]);
    });

    it('leaves out the overdue reminders and the due-soon reminders of each kind the user turns off', async () => {
      const session = await signIn();
      await createExpense(session, { amount: '100', dueDate: dayFrom(-2) });
      const bill = await createExpense(session, {
        amount: '30',
        dueDate: dayFrom(1)
      });
      const plan = await createPlan(session, {
        totalAmount: '40',
        installmentCount: 2,
        firstDueDate: dayFrom(2)
      });
      const [installment] = (await readPlan(session, plan)).installments;

      const ids = (group: { items: Array<{ id: string }> }) =>
        group.items.map(({ id }) => id);
      const remindWith = async (settings: object) => {
        const saved = await session.put(SETTINGS_ROUTE, {
          ...DEFAULT_SETTINGS,
          ...settings
        });

        assert.equal(saved.status, 200, JSON.stringify(saved.body));

        return Promise.all([
          session.get(ALERTS_ROUTE),
          session.get(SUMMARY_ROUTE)
        ]);
      };

      const [noOverdue, noOverdueSummary] = await remindWith({
        remindOverdue: false
      });
      const [noBills, noBillsSummary] = await remindWith({
        remindUpcomingBills: false
      });
      const [noInstallments] = await remindWith({
        remindUpcomingInstallments: false
      });

      assert.deepEqual(noOverdue.body.overdue, {
        items: [],
        totals: [],
        count: 0
      });
      assert.deepEqual(ids(noOverdue.body.dueSoon), [bill, installment.id]);
      assert.deepEqual(noOverdueSummary.body.overdue, {
        amount: '100',
        count: 1
      });
      assert.equal(noBills.body.overdue.count, 1);
      assert.deepEqual(ids(noBills.body.dueSoon), [installment.id]);
      assert.deepEqual(noBillsSummary.body.dueSoon, { amount: '20', count: 1 });
      assert.deepEqual(ids(noInstallments.body.dueSoon), [bill]);
    });

    it('refuses settings that are missing or out of range, and keeps them per user', async () => {
      const session = await signIn();
      const other = await signIn(INTRUDER_EMAIL);
      const invalid = [
        { reminderLeadDays: 31 },
        { reminderLeadDays: -1 },
        { reminderLeadDays: 2.5 },
        { reminderLeadDays: '5' },
        { reminderLeadDays: null },
        { remindOverdue: 'false' },
        { remindUpcomingBills: null },
        { remindUpcomingInstallments: undefined }
      ];

      for (const settings of invalid) {
        const res = await session.put(SETTINGS_ROUTE, {
          ...DEFAULT_SETTINGS,
          ...settings
        });

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(settings)
        );
      }
      const partial = await session.put(SETTINGS_ROUTE, {
        reminderLeadDays: 5
      });
      await session.put(SETTINGS_ROUTE, {
        reminderLeadDays: 0,
        remindOverdue: false,
        remindUpcomingBills: true,
        remindUpcomingInstallments: false
      });

      assert.equal(partial.status, Errors.VALIDATION.status);
      assert.deepEqual((await session.get(SETTINGS_ROUTE)).body, {
        reminderLeadDays: 0,
        remindOverdue: false,
        remindUpcomingBills: true,
        remindUpcomingInstallments: false
      });
      assert.deepEqual(
        (await other.get(SETTINGS_ROUTE)).body,
        DEFAULT_SETTINGS
      );
    });
  });

  describe('account deletion', () => {
    it("removes the user's finance records and leaves other users' records", async () => {
      const session = await signIn();
      const other = await signIn(INTRUDER_EMAIL);
      const expense = await createExpense(session);
      await pay(session, expense);
      await createPlan(session);
      await createSeries(session);
      await session.put(SETTINGS_ROUTE, {
        ...DEFAULT_SETTINGS,
        reminderLeadDays: 5
      });
      await createExpense(other);

      const res = await client
        .delete(ACCOUNT_ROUTE)
        .set(session.auth)
        .send({ password: FIXTURE_PASSWORD });
      const where = { where: { userId: session.user.id } };
      const remaining = await Promise.all([
        prismaClient.expense.count(where),
        prismaClient.expensePayment.count(where),
        prismaClient.installmentPlan.count(where),
        prismaClient.recurringExpense.count(where),
        prismaClient.financeEvent.count(where),
        prismaClient.financeSettings.count(where)
      ]);

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(remaining, [0, 0, 0, 0, 0, 0]);
      assert.equal(
        await prismaClient.expense.count({ where: { userId: other.user.id } }),
        1
      );
    });
  });
});
