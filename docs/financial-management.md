# Personal financial management

The Finances module tracks what an account owes: one-time bills, purchases in
installments and recurring expenses. It records each payment and reports what
was planned, paid, outstanding and overdue. It sits beside the investment
module and never reads or writes its data. Entities, amounts and days follow
the conventions in [`domain-model.md`](domain-model.md). Errors use the
envelope in [`errors.md`](errors.md).

## Assessment

This is what the codebase offered before the module, and what each finding
meant for it.

| Area | Found | Consequence for the module |
| --- | --- | --- |
| Layers | `routes ▸ controllers ▸ services ▸ domain`, with `infra/database` behind it; the web reaches the API through the proxy in `web/src/app/api/v1` only | The same layers: one router (`FinanceRoutes.ts`), one controller and one service per use case, pure rules in `domain`, and one repository per aggregate |
| Money | `DECIMAL(38,18)` columns, `Prisma.Decimal` in the domain, strings on the wire, `web/src/lib/decimal.ts` on the client | The same representation. `FinanceMoney.ts` adds what bills need: the currency's minor units (from ISO 4217), an exact split into installments and truncated ratios |
| Dates | Investment operations are instants (`executedAt`) | A bill is due on a calendar day, not at an instant. Days are `DATE` columns, handled in UTC by `CalendarDay.ts`, and the caller's day is passed as `today` |
| Currency | ISO 4217 validated by `CurrencyCodeSchema`; exchange rates exist only to value positions | No conversion: every aggregate is over one currency, and amounts in different currencies are listed side by side |
| Ownership | JWT Bearer, `authMiddleware`, data scoped by portfolio | Finance records belong to the user, not to a portfolio: what an account owes does not depend on what it invests. Every query filters by `userId` |
| Persistence | Prisma 7 with `relationMode = "prisma"`, versioned migrations, `runSerializable` with retries | New tables only, with the same relation mode. Every multi-row write runs in a serializable transaction |
| Errors and pagination | Typed `ApplicationError`s and `{ items, page, pageSize, total, totalPages }` | Reused unchanged |
| Web | TanStack Query with keys in `lib/react-query.ts`, one hook module per domain, React Hook Form with zod, Radix primitives, custom SVG/HTML charts, `QuerySection` states | Reused. The charts are the existing custom ones, with no new chart library |
| Notifications | None: no email provider, no push, no scheduler or queue | Reminders are in-app only (see [Notifications](#notifications)) |
| Income or cash balance | None. Portfolio value is invested wealth, not available cash | No projected balance: there is no compatible data to compute one from |
| Accounts and cards | No entity | A free-text `account` field on each record |
| Tests | `node:test` unit tests and integration tests against Postgres; no web test runner (TD-058) | Backend unit and integration tests; the web is checked with `lint`, `typecheck`, `build` and by rendering it |

## Integration

* **Navigation.** The sidebar gains a *Finances* section, set apart from the
  investment sections. Its badge counts the overdue bills. The section has its
  own tabs: Overview, Bills, Installments, Recurring, Calendar and Reports.
* **Separation.** No investment table, route, query key or component changed.
  Finance query keys live under `['finances']`, and no finance write
  invalidates a portfolio key.
* **Shared files touched**, each additively:
  * `backend/src/config/Constants.ts`: the enums, limits and messages.
  * `domain/models/index.ts`, `infra/database/index.ts`, `routes/index.ts` and
    `validation/schema/index.ts`: exports and the router.
  * `CurrencyCodeSchema.ts`: `isSupportedCurrency` extracted, same behavior.
  * `UserRepository.delete`: also removes the user's finance rows, in the
    same transaction.
  * On the web:
    * `sidebar.tsx`: the section and its badge.
    * `submit-button.tsx`: accepts `variant`.
    * `api-proxy.ts`: accepts `put`.
    * `common/utils.ts`: `formatCompactMoney`.
    * `lib/dates.ts`: calendar-day helpers.
    * `lib/decimal.ts`: a return type.
    * `lib/react-query.ts`: the keys.
    * `common/constants.ts`: routes and labels.

## Data model

Migration `backend/prisma/migrations/20261026000000_financial_management`
creates five enums and six tables. It reads and changes no existing table or
row.

| Table | Holds |
| --- | --- |
| `expenses` | Every bill: one-time, an installment of a plan (`installmentPlanId`, `installmentNumber`) or an occurrence of a series (`recurringExpenseId`, `occurrenceDate`). Holds `settledAmount` and `settledOn`, recomputed from the payments, `cancelledAt`, and `isCustomized` for an installment or occurrence edited on its own |
| `expense_payments` | Payments: `amount` and `discount` settle the bill, `fees` are paid on top, and `voidedAt` keeps a voided payment as history |
| `installment_plans` | The plan's description, `frequency` (`MONTHLY` by default) and optional cash price (`principalAmount`). Totals are computed from its installments |
| `recurring_expenses` | The rule (`frequency`, `startDate`, `endDate`), the amount, `isVariable`, and `generatedThrough`, the last day generation covered |
| `finance_events` | Append-only history: `recordType`, `recordId`, `type`, and `changes` as each field's `from` and `to` |
| `finance_settings` | One row per user: `reminderLeadDays`, and the switches `remindOverdue`, `remindUpcomingBills` and `remindUpcomingInstallments` (all on by default) |

One bills table serves all three kinds. Listing, filtering, the calendar and
every aggregate read one table, and a payment always targets a bill.

**Integrity in the database**, besides Prisma's relations:

* Uniqueness:
  * `(installmentPlanId, installmentNumber)`, so an installment exists once;
  * `(recurringExpenseId, occurrenceDate)`, so an occurrence is never
    generated twice.
* Checks on `expenses`:
  * `amount > 0`;
  * `0 ≤ settledAmount ≤ amount`;
  * `settledOn` set exactly when the bill is fully settled;
  * a three-letter currency;
  * a bill is never both an installment and an occurrence.
* Checks elsewhere:
  * a payment's `amount`, `discount` and `fees` are each ≥ 0, and
    `amount + discount > 0`;
  * a plan's cash price, when given, is positive;
  * a series ends on or after its start;
  * `reminderLeadDays` is from 0 to 30.
* Indexes:
  * `expenses (userId, dueDate)`;
  * `expense_payments (userId, paidOn)` and `(expenseId)`;
  * the owner index on each other table;
  * `finance_events (recordType, recordId, createdAt)`.

**Applying and reverting.** `pnpm exec prisma migrate deploy` applies the
migration, as in every environment. Nothing outside the six tables refers to
them, so reverting means dropping those tables and the five enums. Existing
database backups cover the new tables with no extra procedure. No backup
procedure is defined in this repository (TD-060).

## Business rules

The rules live in `backend/src/domain`, as pure functions with unit tests. The
web computes no figure: it shows what the API returns.

### Amounts

* An amount is an exact decimal string, with no more decimal places than the
  currency has minor units: 2 for BRL, 0 for JPY, 3 for KWD.
* Sums never round. A ratio is truncated at 18 places. A recurring series'
  `monthlyEquivalent` is truncated to the minor unit. For example, 100 a week
  is `433.33` a month (× 52 ÷ 12) and 1,000 a year is `83.33`.
* Amounts in different currencies are never added. The summary and the
  report are each over one currency, chosen in the request, and alerts and
  the calendar total by currency.
* The terms:
  * **Planned** (`scheduled`): what the bills due in the period owe,
    cancelled bills excluded.
  * **Paid**: the cash that left in the period, `amount + fees`, by payment
    day.
  * **Settled**: `amount + discount` of the active payments.
  * **Outstanding**: `amount − settled`.
  * **Overdue**: the outstanding of the bills already past due.

### Days

* Days are `YYYY-MM-DD`, stored as `DATE` and computed in UTC, so no server
  or browser time zone moves them.
* *Today* is the caller's calendar day, passed as `today`. The web sends the
  browser's day, so a bill due today stays due until the person's midnight.
  The API accepts a `today` up to one day from its own UTC day, the span of
  the world's time zones. Without `today`, the API uses its UTC day.
* A monthly schedule anchors on the first day. When a month is shorter, it
  falls on the month's last day and returns to the anchor afterwards:
  * from 31 January, the dates are 28 or 29 February, then 31 March;
  * a yearly series started on 29 February falls on 28 February outside leap
    years.

### Status

`CANCELLED` if cancelled. Otherwise `PAID` when fully settled. Otherwise
`OVERDUE` when the due date is before *today*, else `PENDING`. A bill due today
is pending. The status is derived on every read and never stored, so it does
not go stale overnight. Creating a bill never records a payment.

### Payments

* A payment settles `amount + discount` of the bill. `fees` (late interest,
  charges) are paid on top and do not settle anything. Partial payments
  accumulate. The bill is paid on the day of the payment that completes it.
* Every write recomputes `settledAmount` and `settledOn` from the active
  payments, never by increment.
* A payment that would settle more than is owed is refused with `422`, and
  so is a correction that would. Concurrent payments run in serializable
  transactions, so two payments recorded at once never settle beyond the
  amount.
* Refused:
  * a payment that settles nothing (`400`);
  * a payment date in the future (`400`);
  * a payment on a cancelled or already paid bill (`409`).
* A correction keeps the previous values in the history. Voiding a payment
  keeps the row, settles nothing, and blocks further corrections.

### One-time bills

* Every field but the currency can be edited. The amount cannot go below
  what is already settled (`422`).
* A bill with active payments cannot be cancelled or deleted (`409`). Void its
  payments first.
* A cancelled bill can be restored, unless its plan or series is cancelled
  (`409`).
* Installments and occurrences are deleted through their plan or series. On
  their own they can only be cancelled (`422`).
* Editing an installment or occurrence marks it `isCustomized`, so later edits
  to the whole plan or series leave it as it is.

### Installment plans

* The plan is created from **either** the total **or** the installment
  amount, plus the count (1–360), the first due date and the `frequency`:
  weekly, monthly (the default) or yearly. Each installment is counted from
  the first, as a series' occurrences are, so monthly ones follow the
  month-end rule above and yearly ones from 29 February fall on 28 February
  outside leap years.
* A total is split exactly. Each installment gets the total ÷ count,
  truncated to the minor unit, and the first absorbs the remainder: 100 in 3
  is 33.34, 33.33, 33.33. A total too small to give every installment one
  minor unit is refused (`422`).
* With a cash price, `financingCost = total − cash price`.
* `totalAmount`, `outstandingAmount`, the paid and remaining counts,
  `nextDueDate` and `lastDueDate` are computed from the installments that are
  owed. The plan is `COMPLETED` once every remaining installment is paid.
* **Edit**: descriptive fields only. They pass to the open installments that
  were not edited on their own.
* **Reschedule**: replaces the installments after the last one with any
  payment, voided payments included, with `remainingCount` new ones. They add
  up to `remainingAmount` and fall at the plan's frequency from
  `nextDueDate`.
  * Paid and partly paid installments, and every one before them, stay as
    they are, with their history.
  * The detail exposes `keptThroughInstallment`, the last installment a
    reschedule keeps. A `nextDueDate` before that installment's due date is
    refused (`422`).
* **Cancel**: cancels the plan and every installment still owed with no
  active payment. A partly paid installment stays owed, because its payments
  are real. Neither the plan nor its installments can be restored.
* **Delete**: only when no installment has an active payment (`409`
  otherwise). It removes the plan, its installments and their history.

### Recurring expenses

* Weekly, monthly or yearly, from `startDate`, optionally until `endDate`.
  The amount is fixed or variable. A variable amount is an estimate, edited
  per bill.
* Each occurrence is a bill, generated up to 12 months ahead of *today*:
  * At creation, and again before any read that lists or sums bills,
    generation resumes after `generatedThrough`.
  * The unique `(recurringExpenseId, occurrenceDate)` makes concurrent reads
    generate each occurrence once.
  * The start must be within the last 12 months, so creation never generates
    an unbounded backlog of overdue bills.
* `effectiveFrom` of an edit or a stop is at most the day after the 12 months
  generated ahead, or the start when the series starts later (`400`
  otherwise). Occurrences before it that generation has not created yet are
  created first, on the terms before the change, so a lagging series loses
  none and gets none of the new terms early.
* **Edit** applies from `effectiveFrom` (today by default) to the occurrences
  with no payment that were not edited on their own. Earlier bills keep
  their values.
  * An earlier `endDate` removes the unpaid occurrences after it. It is
    refused (`409`) when one of those has a payment.
  * Frequency and start define which days the series falls on, so they
    cannot change.
* **Stop** (`cancel`) from `effectiveFrom`:
  * Occurrences from that day on with no payment ever recorded are removed.
  * Those whose payments were all voided are cancelled.
  * Earlier and partly paid occurrences stay owed, and the series and its
    history are kept.
  * A stopped series cannot be resumed or edited (`409`).
* **Delete**: only with no active payment (`409` otherwise). It removes the
  series, its occurrences and their history.
* Status: `CANCELLED` when stopped, otherwise `ENDED` once `endDate` is
  before *today*, otherwise `ACTIVE`. `nextDueDate` is set only while active.

### History

Every create, edit, cancel, restore, payment, correction, void and reschedule
appends a `finance_events` row, in the same transaction as the write. An edit
records only the fields whose value changed, so `10.50` over `10.5` is no
change. Events are never edited, and are deleted only with the record they
describe.

### Aggregates

| Figure | Definition |
| --- | --- |
| Summary `outstanding` | Count and outstanding of every open bill, whenever due, except recurring bills due after the current month: those are projections, counted in `commitments` |
| Summary `overdue` | Count and outstanding of the past-due bills, from any month |
| Summary `dueSoon` | Open bills due from *today* through *today* + `reminderLeadDays`, of the kinds the reminder switches cover: installments follow `remindUpcomingInstallments`, every other bill `remindUpcomingBills` |
| Summary `current`, `change`, `trend` | The current month's totals, its change against the previous month, and the last 6 months planned against paid |
| Summary `commitments` | What is still to pay in the current month and the next 5, by kind. Overdue amounts from earlier months are reported as overdue, not carried forward |
| Summary `installments` | The active plans, the open installments and their outstanding |
| Summary `recurring` | The active series and the sum of their `monthlyEquivalent`, a projection rather than a contracted amount |
| Report | A span of whole months (1–24) against the span of equal length just before it: totals, the change (`percent` absent when the previous value is zero), by month, by category with its share of the planned total, and by kind |
| Calendar | The days of a month with an owed bill: count, paid count, overdue count and totals by currency |
| Alerts | Overdue and due-soon bills across currencies, each group only as the reminder switches allow: count, totals by currency and the 10 earliest |

## API

Every route requires `Authorization: Bearer`. A record belonging to another
user answers `404`, the same as a missing one. Bodies and queries are
validated with zod, and a refused field answers `400` with `details` under its
path. Days are `YYYY-MM-DD`, months `YYYY-MM`, amounts decimal strings. Reads
that depend on *today* accept `today`.

| Method | Path | Payload | 2xx |
| --- | --- | --- | --- |
| GET | `/v1/finances/summary` | query `currency?` (default `BRL`), `today?` | `200` see [Aggregates](#aggregates); also `currencies`, `reminders` (the settings), `upcoming` (5) |
| GET | `/v1/finances/calendar` | query `month`, `currency?`, `today?` | `200` `{ month, days }` |
| GET | `/v1/finances/reports` | query `from`, `to` (months, at most 24), `currency?`, `today?` | `200` `{ currency, currencies, from, to, totals, previous, change, months, categories, kinds }` |
| GET | `/v1/finances/alerts` | query `today?` | `200` `{ reminders, overdue, dueSoon }` |
| GET / PUT | `/v1/finances/settings` | body `{ reminderLeadDays, remindOverdue, remindUpcomingBills, remindUpcomingInstallments }`, every field required (lead days 0–30, the switches booleans) | `200` the settings / `{ settings, message }` |
| GET | `/v1/finances/expenses` | query `page`, `pageSize`, `sortBy` (`dueDate`, `amount`, `description`, `createdAt`), `sortOrder`, `search`, `status` (a status, or `OPEN` for pending and overdue alike), `kind`, `category`, `currency`, `dueFrom`, `dueTo`, `minAmount`, `maxAmount`, `installmentPlanId`, `recurringExpenseId`, `today?` | `200` paginated `Expense` |
| POST | `/v1/finances/expenses` | `{ description, category, subcategory?, amount, currency, dueDate, entryDate?, paymentMethod?, account?, notes? }` | `201` `{ id, message }` |
| GET | `/v1/finances/expenses/:id` | query `today?` | `200` `Expense` with `payments` and `history` |
| PATCH | `/v1/finances/expenses/:id` | any creation field except `currency`, plus `cancelled` | `200` `{ message }` |
| DELETE | `/v1/finances/expenses/:id` | — | `200` `{ message }` |
| POST | `/v1/finances/expenses/:id/payments` | `{ amount, discount?, fees?, paidOn, method?, notes? }` | `201` `{ payment, message }` |
| PATCH | `/v1/finances/expenses/:id/payments/:paymentId` | any payment field | `200` `{ payment, message }` |
| DELETE | `/v1/finances/expenses/:id/payments/:paymentId` | — (voids the payment, which stays as history) | `200` `{ message }` |
| GET | `/v1/finances/payments` | query `page`, `pageSize`, `currency`, `paidFrom`, `paidTo`, `includeVoided` | `200` paginated payments with the bill's `description`, `category` and `currency` |
| GET | `/v1/finances/installment-plans` | query `page`, `pageSize`, `currency`, `status` | `200` paginated `InstallmentPlan` |
| POST | `/v1/finances/installment-plans` | `{ description, category, …, currency, totalAmount` **or** `installmentAmount, installmentCount, firstDueDate, frequency?` (default `MONTHLY`), `principalAmount?, entryDate? }` | `201` `{ id, message }` |
| GET | `/v1/finances/installment-plans/:id` | query `today?` | `200` plan with `installments`, `keptThroughInstallment` and `history` |
| PATCH | `/v1/finances/installment-plans/:id` | descriptive fields, `principalAmount` | `200` `{ message }` |
| POST | `/v1/finances/installment-plans/:id/reschedule` | `{ remainingAmount, remainingCount, nextDueDate }` | `200` `{ message }` |
| POST | `/v1/finances/installment-plans/:id/cancel` | — | `200` `{ message }` |
| DELETE | `/v1/finances/installment-plans/:id` | — | `200` `{ message }` |
| GET | `/v1/finances/recurring-expenses` | query `page`, `pageSize`, `currency`, `status`, `today?` | `200` paginated `RecurringExpense` |
| POST | `/v1/finances/recurring-expenses` | `{ description, category, …, amount, isVariable?, currency, frequency, startDate, endDate? }` | `201` `{ id, message }` |
| GET | `/v1/finances/recurring-expenses/:id` | query `today?` | `200` series with `history` |
| PATCH | `/v1/finances/recurring-expenses/:id` | descriptive fields, `amount`, `isVariable`, `endDate`, `effectiveFrom?` | `200` `{ message }` |
| POST | `/v1/finances/recurring-expenses/:id/cancel` | `{ effectiveFrom? }` | `200` `{ message }` |
| DELETE | `/v1/finances/recurring-expenses/:id` | — | `200` `{ message }` |

Status codes for a refused write:

* `400`: a refused field, including an `effectiveFrom` past the occurrences
  generated ahead.
* `409`: the record's state forbids it (cancelled, has payments, already
  paid, origin cancelled, an end date over a paid occurrence).
* `422`: a domain rule forbids it:
  * an amount below what was settled;
  * a payment beyond what is owed;
  * an installment or occurrence deleted on its own;
  * a split too small;
  * a reschedule due before the kept installment.

**Proxy.** Each route has a Route Handler under
`web/src/app/api/v1/finances`, which forwards the cookie's token, the query and
the body. Creation goes through `…/create` (for example
`POST /api/v1/finances/expenses/create`), as in the existing proxies. A
payment goes through `POST /api/v1/finances/expenses/[id]/payments/create`.

## Web

| Route | Shows | URL state |
| --- | --- | --- |
| `/finances` | Overview:<br>• overdue and due-soon alerts, as the reminder switches allow;<br>• the total still owed, linking to the unpaid bills, and the month's still owed, overdue, paid and planned, each linking to its records;<br>• planned against paid for 6 months;<br>• next bills;<br>• coming months by kind;<br>• by category;<br>• installment and recurring summaries;<br>• the reminder settings | `currency` |
| `/finances/bills` | Every bill:<br>• search, filters, sorting and pagination;<br>• the bill's dialog, with payments (record, correct, void), edit, cancel or restore, delete and history | `search`, `status`, `kind`, `category`, `currency`, `dueFrom`, `dueTo`, `minAmount`, `maxAmount`, `sortBy`, `sortOrder`, `page`, `expense` |
| `/finances/installments` | Plans with progress and next installment:<br>• the plan's dialog, with every installment "n of N", pay, edit, reschedule, cancel, delete and history | `status`, `page`, `plan` |
| `/finances/recurring` | Series with the next bill and the monthly equivalent:<br>• the series' dialog, with upcoming and earlier bills, pay, edit from a date, stop, delete and history | `status`, `page`, `series` |
| `/finances/calendar` | A month grid with overdue, due and paid marks per day, and the chosen day's bills | `month`, `day` |
| `/finances/reports` | A span of months against the previous span:<br>• planned, paid, still owed and overdue;<br>• by month, category and kind;<br>• the payment history | `from`, `to`, `currency` |

* Every section has loading, error with retry, and empty states. Indicators,
  columns and category bars link to the records behind them: the matching
  bills, or the report's payment history for what was paid.
* The column charts have a legend and a *Show table* view with the exact
  values. Category bars print their values. Status is never shown by color
  alone.
* Forms validate on the client with the same limits as the API. The API
  still validates everything.
* Hooks live in `web/src/hooks/use-finances.ts`, with the query list in
  [`data-fetching.md`](data-fetching.md).

## Notifications

There is no notification infrastructure to integrate with: no email provider,
no push service and no scheduler. Reminders are therefore **in-app only**:

* `GET /v1/finances/alerts` returns the overdue bills and those due within
  `reminderLeadDays` (0–30, default 3). Each group follows its switch:
  overdue bills, bills due soon and installments due soon can each be turned
  off. Both are set in the overview's Reminders card.
* The sidebar badge counts the overdue bills the alerts return, and the
  overview and the bills list show both groups. The overview's *Overdue*
  figure stays, because it is a total, not a reminder.

Nothing is sent outside the app, and the interface says so. An external
channel would need:

* a delivery provider, with its secret;
* a scheduled job that evaluates the alerts per user on the user's own day;
* a record of what was sent, so nothing is sent twice.

The alerts endpoint already computes what such a job would send.

## Running and validating

1. Apply the migration: `cd backend && pnpm exec prisma migrate deploy`.
   Compose's `migrate` service does this.
2. Start the API and the web as in the [README](../README.md#setup). Sign in.
   *Finances* is in the navigation.
3. Run the backend tests: `pnpm test:db:up && pnpm test`.
4. Run the web gates: `pnpm lint`, `pnpm typecheck` and `pnpm build`.

A manual check that covers each rule:

1. Add a bill due yesterday. It shows as overdue in the badge, on the overview
   and in the calendar.
2. Pay it in two parts. It becomes paid on the second payment's day.
3. Add a 12-installment plan from a 31st, and confirm the February
   installment.
4. Pay an installment, then reschedule. The paid installment stays.
5. Add a monthly series, edit it from a later date, then stop it. Earlier
   bills stay, and later unpaid ones disappear.
6. Open Reports for the span, and confirm the totals against the bills list.

## Tests

| File | Tests | Covers |
| --- | --- | --- |
| `domain/CalendarDay.test.ts` | 11 | Parsing, UTC arithmetic, month-end and leap years |
| `domain/Recurrence.test.ts` | 11 | Occurrences by frequency, anchoring on the 31st and on 29 February, end date, next occurrence, status |
| `domain/InstallmentSchedule.test.ts` | 9 | Exact split, monthly, weekly and yearly schedules, plan totals and status, reschedulable installments |
| `domain/ExpenseSettlement.test.ts` | 10 | Settling from active payments, over-settlement, the payment day, status by reference day |
| `domain/FinanceMoney.test.ts` | 10 | Minor units, precision, split, monthly equivalent, ratios, sums |
| `domain/FinanceAggregates.test.ts` | 12 | Totals, months, categories, kinds, commitments, change, calendar days, due soon and the reminder switch per kind |
| `routes/Finances.integration.ts` | 59 | Every route against Postgres:<br>• validation;<br>• user isolation;<br>• partial, corrected, voided and concurrent payments;<br>• transaction rollback;<br>• plans by frequency and reschedules;<br>• series generation, its concurrency, edits, stop and delete, including edits and stops when generation lags or the day is past it;<br>• summary with the total outstanding, calendar, reports, alerts and the reminder switches;<br>• account deletion |

The integration suite runs the investment suites in the same process. They
are the regression check that the module left that behavior unchanged.

## Known limitations

* **Notifications** are in-app only (see above).
* **Recurring series**:
  * frequency and start date are fixed once created;
  * a stopped series cannot be resumed;
  * occurrences exist 12 months ahead and are generated on read, with no
    background job.
* **Installments**: the frequency is fixed once the plan exists, a reschedule
  keeps it, and a cancelled plan cannot be restored.
* **Overview links**: the *Total outstanding* figure leaves out recurring
  bills due after the current month, but the unpaid bills it links to include
  them, since the bills list cannot filter by both kind and day at once. The
  due-soon alert likewise links to every pending bill in the window when only
  installments are left out.
* **Interest** is modeled as the financing cost over the cash price, and as
  fees entered on each payment. No interest rate is computed.
* **Categories** are a fixed list, plus a free-text subcategory.
* **Accounts and cards** are free text, not entities.
* **Currencies** are never converted. Each currency is viewed on its own.
* **Report span**: a report covers at most 24 months.
* **Recurring start**: a series starts at most 12 months back.
* **Projected balance**: there is none, because the app has no income or cash
  data. Investments are not available cash.
* **Data export**: none, because the project has no export convention to
  follow.
* **Deletion**: deleting a record, allowed only without active payments,
  deletes its history too. Cancelling keeps it.
* **Chart palette**: the existing dark-theme chart tokens exceed the
  validator's lightness band (`chart-2` at L 0.759). The palette is shared
  with the investment charts and was left unchanged.
* **Web tests**: the web has no test runner (TD-058). The pages were checked
  by rendering them at 1280 px and 390 px in the app's dark theme. The
  total outstanding, the reminder switches, the unpaid filter and the plan
  frequency were rendered at 1440, 1024 and 390 px.
