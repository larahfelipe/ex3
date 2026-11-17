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
  parseCalendarDay,
  startOfMonth,
  utcToday
} from '@/domain/CalendarDay';
import { cardDueDateOf } from '@/domain/CardStatement';
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
const NOTIFICATIONS_ROUTE = '/v1/finances/notifications';
const NOTIFICATION_MARKS_ROUTE = '/v1/finances/notifications/marks';
const CARDS_ROUTE = '/v1/finances/credit-cards';
const ACCOUNT_ROUTE = '/v1/user';

const expenseRoute = (id: string) => `${EXPENSES_ROUTE}/${id}`;
const paymentsRoute = (id: string) => `${expenseRoute(id)}/payments`;
const paymentRoute = (id: string, paymentId: string) =>
  `${paymentsRoute(id)}/${paymentId}`;
const planRoute = (id: string) => `${PLANS_ROUTE}/${id}`;
const seriesRoute = (id: string) => `${SERIES_ROUTE}/${id}`;
const cardRoute = (id: string) => `${CARDS_ROUTE}/${id}`;

const INTRUDER_EMAIL = 'intruder@ex3.app';

const TODAY = utcToday();

const dayFrom = (days: number) => formatCalendarDay(addDays(TODAY, days));

const comingYearWith = (februaryDays: 28 | 29) => {
  let year = TODAY.getUTCFullYear() + 1;

  while (daysInMonth(year, 1) !== februaryDays) year += 1;

  return year;
};

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
        [{ category: 'INSURANCE' }, 'category'],
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

    it('moves a bill to a new due date, which its status and history follow', async () => {
      const session = await signIn();
      const id = await createExpense(session, { dueDate: dayFrom(-5) });
      const overdue = await readExpense(session, id);

      const res = await session.patch(expenseRoute(id), {
        ...EXPENSE,
        dueDate: dayFrom(3)
      });
      const moved = await readExpense(session, id);

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(overdue.status, 'OVERDUE');
      assert.equal(moved.dueDate, dayFrom(3));
      assert.equal(moved.status, 'PENDING');
      assert.equal(moved.isCustomized, false);
      assert.deepEqual(moved.history[0].changes, {
        dueDate: { from: dayFrom(-5), to: dayFrom(3) }
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

  type CardInstallment = Record<'dueDate' | 'paymentMethod', string> &
    Record<'originalDueDate' | 'creditCardId', string | null>;

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

    it('moves an installment to a new due date, which the plan follows and its later edits leave', async () => {
      const session = await signIn();
      const id = await createPlan(session);
      const [first, second] = (await readPlan(session, id)).installments;

      const res = await session.patch(expenseRoute(first.id), {
        dueDate: planDay('02-10')
      });
      await session.patch(planRoute(id), { description: 'Notebook' });
      const plan = await readPlan(session, id);

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(
        plan.installments.map(
          ({ dueDate, description }: Record<string, string>) => [
            dueDate,
            description
          ]
        ),
        [
          [planDay('02-10'), 'Laptop'],
          [second.dueDate, 'Notebook'],
          [planDay('03-31'), 'Notebook']
        ]
      );
      assert.equal(plan.nextDueDate, planDay('02-10'));
      assert.equal(plan.firstDueDate, planDay('02-10'));
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

    it('ends a new series today or later, allowing a day for the client’s time zone', async () => {
      const session = await signIn();
      const started = { ...SERIES, startDate: monthsFrom(-3) };

      const past = await session.post(SERIES_ROUTE, {
        ...started,
        endDate: dayFrom(-2)
      });
      const yesterday = await session.post(SERIES_ROUTE, {
        ...started,
        endDate: dayFrom(-1)
      });
      const today = await session.post(SERIES_ROUTE, {
        ...started,
        endDate: dayFrom(0)
      });

      assert.equal(past.status, Errors.VALIDATION.status);
      assert.equal(past.body.message, FinanceMessages.END_BEFORE_TODAY);
      assert.equal(yesterday.status, 201, JSON.stringify(yesterday.body));
      assert.equal(today.status, 201, JSON.stringify(today.body));
    });

    it('keeps an end that has passed when it is sent back, but moves an end only to today or later', async () => {
      const session = await signIn();
      const id = await createSeries(session, { startDate: monthsFrom(-3) });
      await prismaClient.recurringExpense.update({
        where: { id },
        data: { endDate: parseCalendarDay(dayFrom(-10)) }
      });

      const kept = await session.patch(seriesRoute(id), {
        endDate: dayFrom(-10),
        amount: '120'
      });
      const moved = await session.patch(seriesRoute(id), {
        endDate: dayFrom(-5)
      });
      const reopened = await session.patch(seriesRoute(id), {
        endDate: dayFrom(0)
      });

      assert.equal(kept.status, 200, JSON.stringify(kept.body));
      assert.equal(moved.status, Errors.VALIDATION.status);
      assert.equal(moved.body.message, FinanceMessages.END_BEFORE_TODAY);
      assert.equal(reopened.status, 200, JSON.stringify(reopened.body));
      assert.equal(
        (await session.get(seriesRoute(id))).body.endDate,
        dayFrom(0)
      );
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

    it('moves an occurrence to its new due date for good, and leaves the series and its other occurrences as they were', async () => {
      const session = await signIn();
      const id = await createSeries(session);
      const [, second, third] = await occurrencesOf(session, id);
      const moved = dayFrom(40);

      const res = await session.patch(expenseRoute(second.id), {
        dueDate: moved
      });
      const read = await session.get(expenseRoute(second.id), {
        today: dayFrom(0)
      });
      await session.patch(seriesRoute(id), { amount: '120' });
      const occurrences = await occurrencesOf(session, id);
      const series = await session.get(seriesRoute(id));

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(read.body.dueDate, moved);
      assert.equal(read.body.occurrenceDate, second.occurrenceDate);
      assert.equal(read.body.isCustomized, true);
      assert.equal(occurrences.length, 13);
      assert.deepEqual(
        occurrences
          .filter((occurrence) => occurrence.id === second.id)
          .map(({ dueDate, amount }) => [dueDate, amount]),
        [[moved, '100']]
      );
      assert.equal(
        occurrences.find((occurrence) => occurrence.id === third.id)?.dueDate,
        third.dueDate
      );
      assert.equal(series.body.startDate, SERIES.startDate);
    });

    it('tells the next bill by the day its bills are due, past a moved or cancelled one', async () => {
      const session = await signIn();
      const id = await createSeries(session);
      const [first, second] = await occurrencesOf(session, id);
      const nextDueDateOf = async () => {
        const [detail, listing] = await Promise.all([
          session.get(seriesRoute(id)),
          session.get(SERIES_ROUTE)
        ]);
        const listed = (
          listing.body.items as Array<Record<'id' | 'nextDueDate', string>>
        ).find((series) => series.id === id);

        assert.equal(listed?.nextDueDate, detail.body.nextDueDate);

        return detail.body.nextDueDate as string | null;
      };

      await session.patch(expenseRoute(first.id), { dueDate: dayFrom(5) });
      const moved = await nextDueDateOf();
      await session.patch(expenseRoute(first.id), { dueDate: dayFrom(-3) });
      const movedBack = await nextDueDateOf();
      await session.patch(expenseRoute(first.id), { dueDate: dayFrom(0) });
      await session.patch(expenseRoute(first.id), { cancelled: true });
      const cancelled = await nextDueDateOf();

      assert.equal(moved, dayFrom(5));
      assert.equal(movedBack, second.dueDate);
      assert.equal(cancelled, second.dueDate);
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

  const CARD = {
    name: 'Nubank',
    lastFourDigits: '1234',
    brand: 'MASTERCARD',
    closingDay: 3,
    dueDay: 10
  };

  const createCard = async (session: Session, overrides: object = {}) => {
    const res = await session.post(CARDS_ROUTE, { ...CARD, ...overrides });

    assert.equal(res.status, 201, JSON.stringify(res.body));

    return res.body.id as string;
  };

  const assertFieldRefused = (
    res: { status: number; body: { details?: Array<{ path: string }> } },
    path: string
  ) => {
    assert.equal(res.status, Errors.VALIDATION.status, path);
    assert.ok(
      res.body.details?.some((detail) => detail.path === path),
      JSON.stringify(res.body)
    );
  };

  const cardDayFrom = (cycle: typeof CARD, day: string) =>
    formatCalendarDay(cardDueDateOf(cycle, parseCalendarDay(day) as Date));

  describe('notifications', () => {
    type FeedItem = Record<'key' | 'kind' | 'notifiedOn', string> &
      Record<'isRead', boolean> &
      Record<'expense', Record<'id', string>>;

    const feedOf = async (session: Session) => {
      const res = await session.get(NOTIFICATIONS_ROUTE);

      assert.equal(res.status, 200, JSON.stringify(res.body));

      return res.body as Record<'notifications', Array<FeedItem>> &
        Record<'unreadCount' | 'total', number>;
    };

    const mark = async (
      session: Session,
      action: 'READ' | 'DISMISS',
      keys?: Array<string>
    ) => {
      const res = await session.post(NOTIFICATION_MARKS_ROUTE, {
        action,
        ...(keys && { keys })
      });

      assert.equal(res.status, 200, JSON.stringify(res.body));

      return res.body as Awaited<ReturnType<typeof feedOf>>;
    };

    const entriesOf = ({ notifications }: Awaited<ReturnType<typeof feedOf>>) =>
      notifications.map(({ kind, isRead, expense }) => [
        kind,
        expense.id,
        isRead
      ]);

    const keyOf = (feed: Awaited<ReturnType<typeof feedOf>>, id: string) =>
      String(feed.notifications.find(({ expense }) => expense.id === id)?.key);

    it('derives one unread notification per overdue or soon-due bill, overdue first on the same day, and never repeats one', async () => {
      const session = await signIn();
      const overdue = await createExpense(session, { dueDate: dayFrom(-2) });
      const soon = await createExpense(session, { dueDate: dayFrom(1) });
      await createExpense(session, { dueDate: dayFrom(10) });
      const settled = await createExpense(session, {
        amount: '7',
        dueDate: dayFrom(-3)
      });
      await pay(session, settled, { amount: '7' });

      const first = await feedOf(session);
      const second = await feedOf(session);

      assert.deepEqual(entriesOf(first), [
        ['OVERDUE', overdue, false],
        ['DUE_SOON', soon, false]
      ]);
      assert.deepEqual(
        first.notifications.map(({ key, notifiedOn }) => [key, notifiedOn]),
        [
          [`overdue:${overdue}:${dayFrom(-2)}`, dayFrom(0)],
          [`due-soon:${soon}:${dayFrom(1)}`, dayFrom(0)]
        ]
      );
      assert.equal(first.unreadCount, 2);
      assert.equal(first.total, 2);
      assert.deepEqual(second, first);
    });

    it('marks one read and dismisses another, keeping both marks across reads', async () => {
      const session = await signIn();
      const overdue = await createExpense(session, { dueDate: dayFrom(-2) });
      const soon = await createExpense(session, { dueDate: dayFrom(1) });
      const feed = await feedOf(session);

      const read = await mark(session, 'READ', [keyOf(feed, overdue)]);
      const dismissed = await mark(session, 'DISMISS', [keyOf(feed, soon)]);
      const reread = await mark(session, 'READ', [keyOf(feed, soon)]);

      assert.deepEqual(entriesOf(read), [
        ['OVERDUE', overdue, true],
        ['DUE_SOON', soon, false]
      ]);
      assert.equal(read.unreadCount, 1);
      assert.deepEqual(entriesOf(dismissed), [['OVERDUE', overdue, true]]);
      assert.equal(dismissed.unreadCount, 0);
      assert.deepEqual(reread, dismissed);
      assert.deepEqual(await feedOf(session), dismissed);
    });

    it('marks every active notification when no key is given', async () => {
      const session = await signIn();
      await createExpense(session, { dueDate: dayFrom(-2) });
      await createExpense(session, { dueDate: dayFrom(0) });

      const allRead = await mark(session, 'READ');
      const cleared = await mark(session, 'DISMISS');

      assert.equal(allRead.total, 2);
      assert.equal(allRead.unreadCount, 0);
      assert.deepEqual(cleared, {
        notifications: [],
        unreadCount: 0,
        total: 0
      });
    });

    it('resolves a notification with its bill and raises it anew, unread, when the condition returns or the due date moves', async () => {
      const session = await signIn();
      const overdue = await createExpense(session, { dueDate: dayFrom(-2) });
      const moved = await createExpense(session, { dueDate: dayFrom(1) });
      const cancelled = await createExpense(session, { dueDate: dayFrom(2) });
      const feed = await feedOf(session);
      await mark(session, 'READ', [keyOf(feed, overdue)]);
      await mark(session, 'DISMISS', [keyOf(feed, moved)]);

      const paymentId = await pay(session, overdue, { amount: '100.00' });
      await session.patch(expenseRoute(cancelled), { cancelled: true });
      await session.patch(expenseRoute(moved), { dueDate: dayFrom(2) });
      const resolved = await feedOf(session);
      await session.remove(paymentRoute(overdue, paymentId));
      const returned = await feedOf(session);

      assert.deepEqual(entriesOf(resolved), [['DUE_SOON', moved, false]]);
      assert.equal(keyOf(resolved, moved), `due-soon:${moved}:${dayFrom(2)}`);
      assert.deepEqual(entriesOf(returned), [
        ['OVERDUE', overdue, false],
        ['DUE_SOON', moved, false]
      ]);
    });

    it('follows the reminder switches', async () => {
      const session = await signIn();
      await createExpense(session, { dueDate: dayFrom(-2) });
      const later = await createExpense(session, { dueDate: dayFrom(6) });
      await session.put(SETTINGS_ROUTE, {
        ...DEFAULT_SETTINGS,
        reminderLeadDays: 7,
        remindOverdue: false
      });

      assert.deepEqual(entriesOf(await feedOf(session)), [
        ['DUE_SOON', later, false]
      ]);
    });

    it("keeps notifications and marks per user, skipping keys that are not the user's own", async () => {
      const session = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      const overdue = await createExpense(session, { dueDate: dayFrom(-2) });
      const key = keyOf(await feedOf(session), overdue);

      const foreign = await mark(intruder, 'DISMISS', [key]);

      assert.deepEqual(foreign, {
        notifications: [],
        unreadCount: 0,
        total: 0
      });
      assert.deepEqual(entriesOf(await feedOf(session)), [
        ['OVERDUE', overdue, false]
      ]);
      assert.equal(
        await prismaClient.financeNotificationMark.count({
          where: { userId: intruder.user.id }
        }),
        0
      );
    });

    it('refuses an unknown action, malformed keys, an empty or oversized list and a far-off day', async () => {
      const session = await signIn();
      const key = `overdue:${MISSING_UUID}:${dayFrom(-2)}`;
      const invalid: Array<[object, string]> = [
        [{ action: 'ARCHIVE' }, 'action'],
        [{}, 'action'],
        [{ action: 'READ', keys: [] }, 'keys'],
        [{ action: 'READ', keys: 'all' }, 'keys'],
        [{ action: 'READ', keys: ['overdue:1:2026-01-01'] }, 'keys.0'],
        [
          { action: 'READ', keys: Array.from({ length: 51 }, () => key) },
          'keys'
        ],
        [{ action: 'READ', today: dayFrom(5) }, 'today']
      ];

      for (const [body, path] of invalid) {
        const res = await session.post(NOTIFICATION_MARKS_ROUTE, body);

        assert.equal(
          res.status,
          Errors.VALIDATION.status,
          JSON.stringify(body)
        );
        assert.ok(
          res.body.details?.some(
            (detail: Record<'path', string>) => detail.path === path
          ),
          JSON.stringify(res.body)
        );
      }

      assert.equal(
        (await session.get(NOTIFICATIONS_ROUTE, { today: dayFrom(-5) })).status,
        Errors.VALIDATION.status
      );
      assert.equal(
        (await client.get(NOTIFICATIONS_ROUTE)).status,
        Errors.AUTHENTICATION.status
      );
    });
  });

  describe('credit cards', () => {
    it('creates, lists, edits and deletes a card, keeping only its last four digits', async () => {
      const session = await signIn();

      const id = await createCard(session, {
        cardNumber: '5555444433331234',
        cvv: '123',
        expiryDate: '12/30'
      });
      const created = await session.get(CARDS_ROUTE);
      const edited = await session.patch(cardRoute(id), {
        name: 'Nubank Ultravioleta',
        lastFourDigits: '9876',
        brand: 'VISA'
      });
      const listed = await session.get(CARDS_ROUTE);
      const deleted = await session.remove(cardRoute(id));
      const afterDelete = await session.get(CARDS_ROUTE);
      const row = await prismaClient.creditCard.findUniqueOrThrow({
        where: { id }
      });

      assert.equal(created.status, 200, JSON.stringify(created.body));
      assert.deepEqual(Object.keys(created.body[0]).toSorted(), [
        'brand',
        'closingDay',
        'createdAt',
        'dueDay',
        'id',
        'lastFourDigits',
        'name',
        'unpaidBillCount',
        'updatedAt'
      ]);
      assert.equal(created.body[0].unpaidBillCount, 0);
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(edited.body.movedBills, 0);
      assert.deepEqual(
        listed.body.map(({ name, lastFourDigits, brand }: typeof CARD) => ({
          name,
          lastFourDigits,
          brand
        })),
        [{ name: 'Nubank Ultravioleta', lastFourDigits: '9876', brand: 'VISA' }]
      );
      assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
      assert.deepEqual(afterDelete.body, []);
      assert.notEqual(row.deletedAt, null);
      assert.equal((await session.remove(cardRoute(id))).status, 404);
      assert.equal(
        (await session.patch(cardRoute(id), { name: 'Back' })).status,
        404
      );
    });

    it('refuses invalid card input field by field, and a name holding a card number', async () => {
      const session = await signIn();
      const id = await createCard(session);

      const cases: Array<[object, string]> = [
        [{ name: '' }, 'name'],
        [{ name: 'x'.repeat(41) }, 'name'],
        [{ name: 'Visa 4111 1111 1111 1111' }, 'name'],
        [{ name: '4111-1111-1111-1111' }, 'name'],
        [{ lastFourDigits: '123' }, 'lastFourDigits'],
        [{ lastFourDigits: '12345' }, 'lastFourDigits'],
        [{ lastFourDigits: '12a4' }, 'lastFourDigits'],
        [{ brand: 'AMEX' }, 'brand'],
        [{ closingDay: 0 }, 'closingDay'],
        [{ closingDay: 32 }, 'closingDay'],
        [{ closingDay: 1.5 }, 'closingDay'],
        [{ dueDay: 3 }, 'dueDay']
      ];

      for (const [overrides, path] of cases)
        assertFieldRefused(
          await session.post(CARDS_ROUTE, { ...CARD, ...overrides }),
          path
        );

      assertFieldRefused(
        await session.patch(cardRoute(id), { closingDay: 10 }),
        'dueDay'
      );
      assertFieldRefused(
        await session.patch(cardRoute(id), { lastFourDigits: '1' }),
        'lastFourDigits'
      );
      assert.equal(await prismaClient.creditCard.count(), 1);
    });

    it("keeps each user's cards to them, for listing, editing, deleting and charging", async () => {
      const owner = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      const id = await createCard(owner);

      const listed = await intruder.get(CARDS_ROUTE);
      const edited = await intruder.patch(cardRoute(id), { name: 'Mine' });
      const deleted = await intruder.remove(cardRoute(id));
      const charged = await intruder.post(EXPENSES_ROUTE, {
        ...EXPENSE,
        creditCardId: id
      });
      const missing = await owner.post(EXPENSES_ROUTE, {
        ...EXPENSE,
        creditCardId: MISSING_UUID
      });

      assert.deepEqual(listed.body, []);
      assert.equal(edited.status, 404);
      assert.equal(deleted.status, 404);
      assertFieldRefused(charged, 'creditCardId');
      assertFieldRefused(missing, 'creditCardId');
      assert.equal(
        (await owner.get(CARDS_ROUTE)).body[0].name,
        CARD.name,
        'the card is unchanged'
      );
      assert.equal(await prismaClient.expense.count(), 0);
    });

    it("moves a bill charged to a card to its statement's due date, keeping the bill's own", async () => {
      const session = await signIn();
      const card = await createCard(session);
      const shortMonths = await createCard(session, {
        name: 'Itaú',
        closingDay: 24,
        dueDay: 31
      });

      const cases: Array<[string, string, string]> = [
        [card, planDay('11-02'), planDay('11-10')],
        [card, planDay('11-03'), planDay('12-10')],
        [card, planDay('11-05'), planDay('12-10')],
        [card, planDay('12-15'), `${PLAN_YEAR + 1}-01-10`],
        [shortMonths, planDay('02-10'), planDay('02-28')],
        [shortMonths, planDay('04-01'), planDay('04-30')]
      ];

      for (const [creditCardId, dueDate, cardDueDate] of cases) {
        const id = await createExpense(session, { dueDate, creditCardId });
        const expense = await readExpense(session, id);

        assert.equal(expense.dueDate, cardDueDate, dueDate);
        assert.equal(expense.originalDueDate, dueDate);
        assert.equal(expense.creditCardId, creditCardId);
        assert.equal(expense.paymentMethod, 'CREDIT_CARD');
        assert.equal(expense.status, 'PENDING');
      }

      const plain = await readExpense(session, await createExpense(session));

      assert.equal(plain.dueDate, EXPENSE.dueDate);
      assert.equal(plain.originalDueDate, null);
      assert.equal(plain.creditCard, null);
    });

    it('is overdue only once the card payment date has passed', async () => {
      const session = await signIn();
      const card = await createCard(session);

      const id = await createExpense(session, {
        dueDate: dayFrom(-2),
        creditCardId: card
      });
      const expense = await readExpense(session, id);

      assert.equal(expense.dueDate, cardDayFrom(CARD, dayFrom(-2)));
      assert.ok(expense.dueDate > dayFrom(0), expense.dueDate);
      assert.equal(expense.status, 'PENDING');
    });

    it('refuses a card with another payment method, and a deleted card', async () => {
      const session = await signIn();
      const card = await createCard(session);
      const deleted = await createCard(session, { name: 'Old' });
      await session.remove(cardRoute(deleted));
      const bill = await createExpense(session, { creditCardId: card });

      const pix = await session.post(EXPENSES_ROUTE, {
        ...EXPENSE,
        paymentMethod: 'PIX',
        creditCardId: card
      });
      const toDeleted = await session.post(EXPENSES_ROUTE, {
        ...EXPENSE,
        creditCardId: deleted
      });
      const switchToPix = await session.patch(expenseRoute(bill), {
        paymentMethod: 'PIX'
      });
      const switchToDeleted = await session.patch(expenseRoute(bill), {
        creditCardId: deleted
      });

      assertFieldRefused(pix, 'paymentMethod');
      assertFieldRefused(toDeleted, 'creditCardId');
      assertFieldRefused(switchToPix, 'paymentMethod');
      assertFieldRefused(switchToDeleted, 'creditCardId');
      assert.equal((await readExpense(session, bill)).creditCardId, card);
    });

    it("recomputes a bill's dates from its own due date when its card or that date changes, and records each change", async () => {
      const session = await signIn();
      const nubank = await createCard(session);
      const itau = await createCard(session, {
        name: 'Itaú',
        lastFourDigits: '4321',
        brand: 'VISA',
        closingDay: 25,
        dueDay: 5
      });
      const id = await createExpense(session, {
        dueDate: planDay('11-20'),
        creditCardId: nubank
      });

      const switched = await session.patch(expenseRoute(id), {
        creditCardId: itau
      });
      const afterSwitch = await readExpense(session, id);
      await session.patch(expenseRoute(id), { dueDate: planDay('11-26') });
      const afterDate = await readExpense(session, id);
      await session.patch(expenseRoute(id), {
        creditCardId: null,
        paymentMethod: 'PIX'
      });
      const afterRemoval = await readExpense(session, id);
      await session.patch(expenseRoute(id), {
        creditCardId: nubank,
        paymentMethod: null
      });
      const afterReadd = await readExpense(session, id);

      assert.equal(switched.status, 200, JSON.stringify(switched.body));
      assert.equal(afterSwitch.dueDate, planDay('12-05'));
      assert.equal(afterSwitch.originalDueDate, planDay('11-20'));
      assert.equal(afterSwitch.creditCard.name, 'Itaú');
      assert.equal(afterDate.dueDate, `${PLAN_YEAR + 1}-01-05`);
      assert.equal(afterDate.originalDueDate, planDay('11-26'));
      assert.equal(afterRemoval.dueDate, planDay('11-26'));
      assert.equal(afterRemoval.originalDueDate, null);
      assert.equal(afterRemoval.creditCard, null);
      assert.equal(afterRemoval.paymentMethod, 'PIX');
      assert.equal(afterReadd.dueDate, planDay('12-10'));
      assert.equal(afterReadd.paymentMethod, 'CREDIT_CARD');
      assert.deepEqual(afterSwitch.history[0].changes, {
        dueDate: { from: planDay('12-10'), to: planDay('12-05') },
        creditCard: {
          from: { name: 'Nubank', brand: 'MASTERCARD', lastFourDigits: '1234' },
          to: { name: 'Itaú', brand: 'VISA', lastFourDigits: '4321' }
        }
      });
      assert.deepEqual(afterRemoval.history[0].changes, {
        paymentMethod: { from: 'CREDIT_CARD', to: 'PIX' },
        dueDate: { from: `${PLAN_YEAR + 1}-01-05`, to: planDay('11-26') },
        originalDueDate: { from: planDay('11-26'), to: null },
        creditCard: {
          from: { name: 'Itaú', brand: 'VISA', lastFourDigits: '4321' },
          to: null
        }
      });
    });

    it('moves only the unpaid bills on a card when its days change, recording each move', async () => {
      const session = await signIn();
      const card = await createCard(session);
      const other = await createCard(session, { name: 'Other' });
      const unpaid = await createExpense(session, {
        dueDate: planDay('11-05'),
        creditCardId: card
      });
      const partlyPaid = await createExpense(session, {
        dueDate: planDay('11-05'),
        creditCardId: card
      });
      const paid = await createExpense(session, {
        dueDate: planDay('11-05'),
        creditCardId: card
      });
      const cancelled = await createExpense(session, {
        dueDate: planDay('11-05'),
        creditCardId: card
      });
      const elsewhere = await createExpense(session, {
        dueDate: planDay('11-05'),
        creditCardId: other
      });
      await pay(session, partlyPaid);
      await pay(session, paid, { amount: '100.00' });
      await session.patch(expenseRoute(cancelled), { cancelled: true });

      const listed = await session.get(CARDS_ROUTE);
      const renamed = await session.patch(cardRoute(card), { name: 'Renamed' });
      const res = await session.patch(cardRoute(card), {
        closingDay: 8,
        dueDay: 15
      });
      const dueDates = await Promise.all(
        [unpaid, partlyPaid, paid, cancelled, elsewhere].map(
          async (id) => (await readExpense(session, id)).dueDate
        )
      );
      const moved = await readExpense(session, unpaid);
      const resaved = await session.patch(expenseRoute(paid), {
        dueDate: planDay('11-05'),
        notes: 'Paid before the card changed'
      });
      const paidAfterEdit = await readExpense(session, paid);

      assert.equal(
        listed.body.find(({ id }: { id: string }) => id === card)
          .unpaidBillCount,
        1
      );
      assert.equal(resaved.status, 200, JSON.stringify(resaved.body));
      assert.equal(paidAfterEdit.dueDate, planDay('12-10'));
      assert.deepEqual(Object.keys(paidAfterEdit.history[0].changes), [
        'notes'
      ]);
      assert.equal(renamed.body.movedBills, 0);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal(res.body.movedBills, 1);
      assert.deepEqual(dueDates, [
        planDay('11-15'),
        planDay('12-10'),
        planDay('12-10'),
        planDay('12-10'),
        planDay('12-10')
      ]);
      assert.equal(moved.originalDueDate, planDay('11-05'));
      assert.equal(moved.isCustomized, false);
      assert.deepEqual(moved.history[0], {
        ...moved.history[0],
        type: 'UPDATED',
        changes: { dueDate: { from: planDay('12-10'), to: planDay('11-15') } }
      });
    });

    it('keeps a deleted card on the bills and series charged to it, with their dates', async () => {
      const session = await signIn();
      const card = await createCard(session);
      const bill = await createExpense(session, {
        dueDate: planDay('11-05'),
        creditCardId: card
      });
      const series = await createSeries(session, { creditCardId: card });
      const before = await occurrencesOf(session, series);

      await session.remove(cardRoute(card));
      const edited = await session.patch(expenseRoute(bill), {
        notes: 'Still on the card',
        dueDate: planDay('11-02')
      });
      const expense = await readExpense(session, bill);
      const seriesRead = await session.get(seriesRoute(series));
      const after = await occurrencesOf(session, series);

      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(expense.creditCardId, card);
      assert.notEqual(expense.creditCard.deletedAt, null);
      assert.equal(expense.dueDate, planDay('11-10'));
      assert.equal(seriesRead.body.creditCardId, card);
      assert.notEqual(seriesRead.body.creditCard.deletedAt, null);
      assert.deepEqual(
        after.map(({ dueDate }) => dueDate),
        before.map(({ dueDate }) => dueDate)
      );
    });

    it("charges a recurring expense's bills to its card and moves the following unpaid ones when the card changes", async () => {
      const session = await signIn();
      const card = await createCard(session);
      const other = await createCard(session, {
        name: 'Other',
        closingDay: 20,
        dueDay: 1
      });
      const cycleOf = { ...CARD, closingDay: 20, dueDay: 1 };
      const id = await createSeries(session, {
        frequency: 'WEEKLY',
        startDate: dayFrom(0),
        endDate: dayFrom(28),
        creditCardId: card
      });
      const created = (await occurrencesOf(session, id)).toSorted((a, b) =>
        a.occurrenceDate.localeCompare(b.occurrenceDate)
      );
      const series = await session.get(seriesRoute(id));
      const [first, second] = created;
      await pay(session, first.id, { amount: '100.00' });
      await session.patch(expenseRoute(second.id), { notes: 'Customized' });

      const inOrder = async () =>
        (await occurrencesOf(session, id)).toSorted((a, b) =>
          a.occurrenceDate.localeCompare(b.occurrenceDate)
        );

      const switched = await session.patch(seriesRoute(id), {
        creditCardId: other
      });
      const afterSwitch = await inOrder();
      const removed = await session.patch(seriesRoute(id), {
        creditCardId: null
      });
      const afterRemoval = await inOrder();
      const history = (await session.get(seriesRoute(id))).body.history;

      assert.deepEqual(
        created.map(({ occurrenceDate, dueDate }) => [occurrenceDate, dueDate]),
        created.map(({ occurrenceDate }) => [
          occurrenceDate,
          cardDayFrom(CARD, occurrenceDate)
        ])
      );
      assert.equal(series.body.nextDueDate, cardDayFrom(CARD, dayFrom(0)));
      assert.equal(series.body.paymentMethod, 'CREDIT_CARD');
      assert.equal(switched.status, 200, JSON.stringify(switched.body));
      assert.deepEqual(
        afterSwitch.map(({ dueDate }) => dueDate),
        afterSwitch.map(({ occurrenceDate }, index) =>
          index < 2
            ? cardDayFrom(CARD, occurrenceDate)
            : cardDayFrom(cycleOf, occurrenceDate)
        )
      );
      assert.equal(removed.status, 200, JSON.stringify(removed.body));
      assert.deepEqual(
        afterRemoval.map(({ dueDate }) => dueDate),
        afterRemoval.map(({ occurrenceDate }, index) =>
          index < 2 ? cardDayFrom(CARD, occurrenceDate) : occurrenceDate
        )
      );
      assert.deepEqual(history[0].changes.creditCard, {
        from: { name: 'Other', brand: 'MASTERCARD', lastFourDigits: '1234' },
        to: null
      });
    });

    it("charges every installment of a plan to its card, each on the statement of its own date, and moves them with the card's days", async () => {
      const session = await signIn();
      const card = await createCard(session);
      const id = await createPlan(session, { creditCardId: card });
      const ownDays = [planDay('01-31'), planDay('02-28'), planDay('03-31')];

      const plan = await readPlan(session, id);
      const listed = await session.get(PLANS_ROUTE);
      const edited = await session.patch(cardRoute(card), {
        closingDay: 25,
        dueDay: 5
      });
      const moved = await readPlan(session, id);
      const later = { ...CARD, closingDay: 25, dueDay: 5 };

      assert.equal(plan.creditCardId, card);
      assert.deepEqual(
        [plan.creditCard.name, plan.creditCard.lastFourDigits],
        [CARD.name, CARD.lastFourDigits]
      );
      assert.equal(plan.paymentMethod, 'CREDIT_CARD');
      assert.deepEqual(
        plan.installments.map(
          ({
            dueDate,
            originalDueDate,
            creditCardId,
            paymentMethod
          }: CardInstallment) => [
            dueDate,
            originalDueDate,
            creditCardId,
            paymentMethod
          ]
        ),
        ownDays.map((day) => [cardDayFrom(CARD, day), day, card, 'CREDIT_CARD'])
      );
      assert.equal(plan.nextDueDate, cardDayFrom(CARD, ownDays[0]));
      assert.deepEqual(plan.history[0].changes.creditCard, {
        name: CARD.name,
        brand: CARD.brand,
        lastFourDigits: CARD.lastFourDigits
      });
      assert.equal(listed.body.items[0].creditCard.id, card);
      assert.equal(edited.status, 200, JSON.stringify(edited.body));
      assert.equal(edited.body.movedBills, 3);
      assert.deepEqual(
        moved.installments.map(({ dueDate }: CardInstallment) => dueDate),
        ownDays.map((day) => cardDayFrom(later, day))
      );
    });

    it("refuses a plan on a card with another payment method, or on a card that is deleted or someone else's", async () => {
      const session = await signIn();
      const intruder = await signIn(INTRUDER_EMAIL);
      const card = await createCard(session);
      const deleted = await createCard(session, { name: 'Old' });
      await session.remove(cardRoute(deleted));

      assertFieldRefused(
        await session.post(PLANS_ROUTE, {
          ...PLAN,
          paymentMethod: 'PIX',
          creditCardId: card
        }),
        'paymentMethod'
      );
      assertFieldRefused(
        await session.post(PLANS_ROUTE, { ...PLAN, creditCardId: deleted }),
        'creditCardId'
      );
      assertFieldRefused(
        await intruder.post(PLANS_ROUTE, { ...PLAN, creditCardId: card }),
        'creditCardId'
      );
      assert.equal(await prismaClient.installmentPlan.count(), 0);
      assert.equal(await prismaClient.expense.count(), 0);
    });

    it("moves a plan's unpaid installments when its card changes, customized ones too, keeping paid ones and recording the change", async () => {
      const session = await signIn();
      const card = await createCard(session);
      const other = await createCard(session, {
        name: 'Other',
        closingDay: 20,
        dueDay: 1
      });
      const otherCycle = { ...CARD, closingDay: 20, dueDay: 1 };
      const id = await createPlan(session);
      const ownDays = [planDay('01-31'), planDay('02-28'), planDay('03-31')];
      const [first, second] = (await readPlan(session, id)).installments;
      await pay(session, first.id, { amount: first.amount });
      await session.patch(expenseRoute(second.id), { notes: 'Customized' });

      const added = await session.patch(planRoute(id), { creditCardId: card });
      const afterAdding = await readPlan(session, id);
      const switched = await session.patch(planRoute(id), {
        creditCardId: other
      });
      const afterSwitch = await readPlan(session, id);
      const removed = await session.patch(planRoute(id), {
        creditCardId: null
      });
      const afterRemoval = await readPlan(session, id);

      assert.equal(added.status, 200, JSON.stringify(added.body));
      assert.equal(afterAdding.paymentMethod, 'CREDIT_CARD');
      assert.deepEqual(
        afterAdding.installments.map(({ dueDate }: CardInstallment) => dueDate),
        [
          ownDays[0],
          cardDayFrom(CARD, ownDays[1]),
          cardDayFrom(CARD, ownDays[2])
        ]
      );
      assert.equal(afterAdding.installments[0].creditCardId, null);
      assert.equal(switched.status, 200, JSON.stringify(switched.body));
      assert.deepEqual(
        afterSwitch.installments.map(
          ({ dueDate, creditCardId }: CardInstallment) => [
            dueDate,
            creditCardId
          ]
        ),
        [
          [ownDays[0], null],
          [cardDayFrom(otherCycle, ownDays[1]), other],
          [cardDayFrom(otherCycle, ownDays[2]), other]
        ]
      );
      assert.equal(afterSwitch.installments[1].notes, 'Customized');
      assert.equal(removed.status, 200, JSON.stringify(removed.body));
      assert.deepEqual(
        afterRemoval.installments.map(
          ({ dueDate, originalDueDate }: CardInstallment) => [
            dueDate,
            originalDueDate
          ]
        ),
        ownDays.map((day) => [day, null])
      );
      assert.equal(afterRemoval.creditCard, null);
      assert.deepEqual(afterRemoval.history[0].changes.creditCard, {
        from: { name: 'Other', brand: 'MASTERCARD', lastFourDigits: '1234' },
        to: null
      });
    });

    it("reschedules a plan on a card from its installments' own dates, charging the new ones to the card", async () => {
      const session = await signIn();
      const card = await createCard(session);
      const id = await createPlan(session, { creditCardId: card });
      const [first] = (await readPlan(session, id)).installments;
      await pay(session, first.id, { amount: first.amount });

      const beforeKept = await session.post(`${planRoute(id)}/reschedule`, {
        remainingAmount: '600.00',
        remainingCount: 2,
        nextDueDate: planDay('01-30')
      });
      const res = await session.post(`${planRoute(id)}/reschedule`, {
        remainingAmount: '600.00',
        remainingCount: 2,
        nextDueDate: planDay('02-05')
      });
      const plan = await readPlan(session, id);

      assert.equal(first.dueDate, cardDayFrom(CARD, planDay('01-31')));
      assert.ok(planDay('02-05') < first.dueDate);
      assert.equal(beforeKept.status, Errors.DOMAIN.status);
      assert.match(beforeKept.body.message, new RegExp(planDay('01-31')));
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(
        plan.installments
          .slice(1)
          .map(
            ({ dueDate, originalDueDate, creditCardId }: CardInstallment) => [
              dueDate,
              originalDueDate,
              creditCardId
            ]
          ),
        [planDay('02-05'), planDay('03-05')].map((day) => [
          cardDayFrom(CARD, day),
          day,
          card
        ])
      );
    });

    it("keeps each installment on its plan's card, refusing a card of its own", async () => {
      const session = await signIn();
      const card = await createCard(session);
      const plain = await createPlan(session);
      const charged = await createPlan(session, { creditCardId: card });
      const [plainFirst] = (await readPlan(session, plain)).installments;
      const [chargedFirst] = (await readPlan(session, charged)).installments;

      assertFieldRefused(
        await session.patch(expenseRoute(plainFirst.id), {
          creditCardId: card
        }),
        'creditCardId'
      );
      assertFieldRefused(
        await session.patch(expenseRoute(chargedFirst.id), {
          creditCardId: null
        }),
        'creditCardId'
      );

      const kept = await session.patch(expenseRoute(chargedFirst.id), {
        notes: 'Same card',
        creditCardId: card
      });
      const [after] = (await readPlan(session, plain)).installments;

      assert.equal(kept.status, 200, JSON.stringify(kept.body));
      assert.equal(after.creditCard, null);
      assert.equal(after.dueDate, plainFirst.dueDate);
      assert.equal(
        (await readExpense(session, chargedFirst.id)).creditCardId,
        card
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
      await createSeries(session, { creditCardId: await createCard(session) });
      await session.put(SETTINGS_ROUTE, {
        ...DEFAULT_SETTINGS,
        reminderLeadDays: 5
      });
      await createExpense(session, { dueDate: dayFrom(-1) });
      await session.post(NOTIFICATION_MARKS_ROUTE, { action: 'DISMISS' });
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
        prismaClient.financeSettings.count(where),
        prismaClient.creditCard.count(where),
        prismaClient.financeNotificationMark.count(where)
      ]);

      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(remaining, [0, 0, 0, 0, 0, 0, 0, 0]);
      assert.equal(
        await prismaClient.expense.count({ where: { userId: other.user.id } }),
        1
      );
    });
  });
});
