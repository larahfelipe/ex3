# Testing

The backend's test infrastructure. It records the decisions that cannot be
deduced from the files.

## Commands

| Command | What it runs | Needs a database |
| --- | --- | --- |
| `pnpm test` | the full suite (unit + integration) | yes |
| `pnpm test:unit` | tests without IO | no |
| `pnpm test:integration` | tests against the real database | yes |
| `pnpm test:unit:watch` | unit in watch mode | no |
| `pnpm test:db:up` / `pnpm test:db:down` | lifecycle of the `postgres-test` service in the root `compose.yaml` | — |

`pnpm test` is the suite's single command. Locally it assumes the database is
up (`pnpm test:db:up`); in CI Postgres is a service container, so `pnpm test` is
enough. In a container, `docker compose run --rm backend-check` brings the
database up and runs the whole set of gates (see
[`containers.md`](containers.md)).

## Two categories, separated by file name

* **unit** — `src/**/*.test.ts`, placed next to the code. No network, no
  database, no real clock.
* **integration** — `src/**/*.integration.ts`, also placed next to the code,
  against the test Postgres and the whole Express application through
  `supertest`.

`App.test.ts` became `App.integration.ts`: it exercises the full HTTP stack, so
once a database is available it queries it. Keeping it in the unit band took
`pnpm test:unit` from 0.5 s to 10 s and made it untrue that the band touches no
IO.

The split is by suffix, not by directory, because the glob `src/**/*.test.ts`
was already the repository's convention and `*.integration.ts` does not collide
with it. That keeps `pnpm test:unit` runnable with no external dependency at
all — which is what allows running it in watch mode.

Integration runs with `--test-concurrency=1`: the files share a single
database, and one file's `TRUNCATE` would invalidate another's fixtures running
in parallel.

Every integration file calls `registerIntegrationHooks()` once, inside the
`describe`. It registers the per-test database and rate-limit reset and the
`$disconnect` at the end of the file. The disconnect is not fastidiousness: the
runner waits for each file's process to finish, and an open pool keeps it alive
for the whole idle timeout — forgetting it cost 10 s per file, with no test
failing.

## Test database

`.env.test` is the **only** source of the connection string, read through
`node --env-file`. Under `NODE_ENV=test`, neither `config/Envs.ts` nor
`prisma.config.ts` loads the developer's `.env`: what the suite does not declare
stays absent, instead of being filled in by a credential that reaches another
database. The `postgres-test` service in `compose.yaml` and the CI service
container use the same credentials (`ex3`/`ex3`/`ex3_test`), so neither
environment redefines database configuration. Because `node --env-file` does not
overwrite a variable already present in the environment, an exported `NODE_ENV`
or `DATABASE_URL` wins over `.env.test`; that is why `resetDatabase()` refuses
to truncate outside `NODE_ENV=test` (`NonTestDatabaseResetError`).

The local container's storage is `tmpfs`: every `up` starts with an empty
cluster. The suite depends on the database being disposable, not on cleaning up
what it left behind.

Isolation between tests comes from `resetDatabase()`, called in `beforeEach`.
The table list is read from `pg_tables` rather than hard-coded — tables
introduced by the PHASE 4 migrations start being truncated without editing the
helper. `_prisma_migrations` is preserved, otherwise every run would reapply the
whole history over an existing schema.

`TRUNCATE` requires interpolated identifiers (they cannot be bound as
parameters). The names come from the test database's own catalog, never from
test input; it is the repository's only `$executeRawUnsafe` call.

## Schema: migrations are now versioned

`prisma/migrations` was in `.gitignore`, and so the directory did not exist. The
effect was silent and serious: the `prisma migrate deploy` of the `migrate.yaml`
workflow never had anything to apply, and the production schema was not
reproducible from the repository.

The entry was removed from `.gitignore` and the initial migration (`0_init`) was
generated from `schema.prisma` with `prisma migrate diff --from-empty`. The test
database is provisioned through the same path as production —
`prisma migrate deploy` — not through `db push`.

`relationMode = "prisma"` is still in the schema, so the database has no foreign
keys: fixtures may insert a `Portfolio` with a non-existent `userId` without
error. It is a limitation inherited from the current model, re-evaluated in
PHASE 4.

## Provisioning: a script, not `--test-global-setup`

`pnpm test:integration` runs `src/test/PrepareTestDatabase.ts` as a separate
process ahead of the runner. Node's `--test-global-setup` flag would be the
natural place, but it resolves the setup module **synchronously**, which ignores
`tsx`'s loader hooks: any import from the setup file (`./TestDatabase`,
`@/infra/...`) fails with `ERR_MODULE_NOT_FOUND`.

The script does two things: it proves the database answers (`SELECT 1` — with a
driver adapter `$connect` resolves even when it is unreachable, see
[`toolchain.md`](toolchain.md)) and applies the migrations. If the database does
not answer, the message points at `pnpm test:db:up` instead of leaking a Prisma
stack.

## Fixtures

`src/test/Fixtures.ts` writes through the Prisma Client directly, **not**
through the repositories: the repositories are the code under test in TASKS
3.3/3.4, and fixtures built on top of them would mask defects.

The exception is the password, which goes through the application's own
`Bcrypt` — that is what lets a test sign in for real with `FIXTURE_PASSWORD`.
The digest is computed once per test process, since every fixture user shares
the same password.

`seedPortfolio()` assembles the smallest coherent graph the API can operate on:
user → portfolio → asset → transaction, with the asset linked to its symbol's
instrument. `createAsset` creates that instrument with `name` equal to the
symbol and type `OTHER` when it does not exist yet, as the catalog migration
does with existing data; `createInstrument` registers the instrument for the
tests that need the symbol in the catalog before calling the API. No value is
random; alternative symbols and emails are passed explicitly by whoever needs
more than one. `createPortfolio` accepts a name, a base currency and a creation
date, for the tests that need several portfolios of the same user in a known
order.

## HTTP client

`signIn()` authenticates through the real endpoint instead of signing a token
locally. The session is stateful (the token's `sessionVersion` must be the one
on the user's row) and it is the endpoint that increments that version, so the
token obtained is the same one a real client would receive. Signing locally is
restricted to the invalid-token tests, which need forged claims.

The rate limiters keep counters in process memory, which survive a test. The
budgets are deliberately tight (10 sign-in failures per account and address
every 15 min), so `resetRateLimits()` is called in `beforeEach` and clears the
`MemoryStore`s of `rateLimitStores` whole instead of listing keys.
`Harness.integration.ts` asserts that a failed sign-in is in fact being counted
before resetting, so that a reset which clears nothing fails instead of passing
silently; a sign-in that gets the password right gives the attempt back and
would not serve as proof. The address tests use the RFC 5737 documentation
blocks, attested by the web's headers with the `API_PROXY_SECRET` from
`.env.test`.

## Mocks

There is no helper of our own: `node:test` already ships `mock.method`, which
replaces a method and restores it on `mock.restoreAll()`. The application's
singletons are shared inside the process of one test file, and the runner gives
one process per file — that is what makes direct replacement safe.
`AuthMiddleware.test.ts` is the example of the convention. The exception is
`PrismaClient`: the instance is a proxy whose descriptor for `runSerializable`
does not carry the method, and `mock.method` over it fails;
`injectWriteFailure` replaces the method on `PrismaClient.prototype` (see
[Atomicity of financial operations](#atomicity-of-financial-operations)).

## Harness

`src/test/Harness.integration.ts` tests the infrastructure itself: that the
migrations created the schema, that the fixtures produce a coherent graph, that
the reset empties every table, that the HTTP client authenticates and reaches a
protected route, that the rate-limit reset hits the real key, and that the
injected failure hits only the chosen write and undoes the previous ones. It is
the test that breaks first when the environment is wrong, instead of letting
TASKS 3.2–3.4 fail for an unrelated reason.

## Asset flow regression — TASK 3.3

`src/routes/Assets.integration.ts` pins down, through the HTTP API, the
behaviour of adding, renaming and deleting assets. That includes isolation
between users: another portfolio's asset answers exactly like a non-existent
asset, is not renamed and is not deleted. The reads the suite also pinned down
went out with `GET /v1/asset/:symbol`, `GET /v1/assets` and
`GET /v1/assets/valuations`; what the assets screen reads today is in
[Valuation](#valuation).

**The test describes what exists.** An inconsistency that does not break the
flow is pinned down as it is and flagged in the test itself, until it is fixed.

**A known defect becomes a `todo` test.** The test asserts the correct
behaviour and fails today, reproducing the defect. `node:test` does not fail the
suite over a `todo`, nor does it warn when one starts passing, so whoever fixes
the defect removes the marker and the test starts protecting the fix. The
summary's `ℹ todo N` is the count of open defects.

The suite's only `todo`, two portfolios with the same symbol (baseline #19:
`Asset.symbol` was globally `@unique` and the second user got a 500), passed
with the instrument catalog and became an ordinary test. See
[Instrument catalog](#instrument-catalog).

**Search.** The assets screen's search, which used to filter the already loaded
page in the web and never found an asset from another page (baseline #25), is
done by `GET /v1/portfolio/positions` over every position in the portfolio (see
[Valuation](#valuation)).

## Fixes made after TASK 3.3

The task's findings were fixed, and the tests that pinned them down started
protecting the fix:

| Finding | Today | Where |
| --- | --- | --- |
| a blank symbol stored as `''` (`min(1)` ran before the `trim`) | `trim` and upper-casing run before the limits: 400 | `validation/schema/asset/AssetSymbolSchema.ts` |
| a fractional `limit` accepted and returned as the page size | `page` and `limit` positive integers, `limit` up to 100 (OWASP API4:2023): 400 | `validation/schema/PaginationQuerySchema.ts` |
| `DELETE` of a missing asset answered 400, and `GET` answered 404 | 404 on `GET`, `PATCH` and `DELETE` | `services/asset/DeleteAssetService.ts`, `services/asset/UpdateAssetService.ts` |
| transactions deleted by `assetSymbol` with no portfolio scope, a latent risk for the domain reshaping | every ledger query, batch asset deletion and account deletion included, filters by the `portfolioId` stored on the transaction | `infra/database/TransactionRepository.ts`, `infra/database/AssetRepository.ts` |
| a transaction `PATCH` added the new impact to the position without undoing the previous one, and answered `Transaction created` | editing undoes the stored impact and applies the new one; it answers `Transaction updated` | `infra/database/TransactionRepository.ts`, `services/transaction/UpdateTransactionService.ts` |
| the ledger row and the position written in independent writes: concurrent `SELL`s passed the same check | one serializable transaction per write: of concurrent `SELL`s, only those the position covers pass | `infra/database/PrismaClient.ts`, `infra/database/TransactionRepository.ts` |
| an edit or deletion that took the position below zero was accepted | 400 `ACC_NEGATIVE_AMOUNT`, changing nothing | `infra/database/TransactionRepository.ts` |
| a transaction `type` with `min`/`max` before the `trim`: `' buy '` refused | `trim` and upper-casing before comparing against the accepted types | `validation/schema/transaction/TransactionTypeSchema.ts` |
| a transaction id accepted as any string and taken to the database | UUID validated in the schema: 400 | `validation/schema/transaction/TransactionIdSchema.ts` |
| asset and account deletion in independent writes; an account with assets answered 500 | one serializable transaction each, dependents first | `infra/database/AssetRepository.ts`, `infra/database/UserRepository.ts` |

**A new symbol and a stored symbol.** Only the symbol that is going to be
stored (`POST /v1/asset` and the rename's `newSymbol`) follows the allowlist of
letters and digits, the same one the web's form uses. Addressing an existing
asset requires only the normalized format, so a symbol stored before the
allowlist (e.g. `BRK.B`) is still read, renamed and deleted without a migration.

**Portfolio scope.** A transaction stores `portfolioId` and `instrumentId`, and
every ledger query filters by the caller's portfolio. With the instrument
catalog, two portfolios may hold the same instrument, and the test that deletes
an asset whose instrument is also in another portfolio confirms that the other
portfolio's transactions stay intact.

**Ledger and position in the same transaction.** Creating, editing and deleting
a transaction reads the position's transactions, rebuilds the position over the
ledger as it will stand after the write, and stores the ledger row and the
position in a single `SERIALIZABLE` transaction
(`PrismaClient.runSerializable`). The ledger is checked over the read made
inside the transaction; if a concurrent write invalidates it, Postgres aborts
one of the sides (`P2034`), which is re-executed from the start, up to 3
attempts. A third consecutive conflict propagates as a 500. The refused attempt
writes nothing, not even to undo it afterwards: the write would enter
serializable conflict detection, and refused concurrent `SELL`s would exhaust
each other's attempts. Prisma does not expose `SELECT ... FOR UPDATE` outside
raw SQL, and the serializable transaction gives the same guarantee through the
typed API. Asset and account deletion use the same mechanism, so as not to leave
an orphan transaction.

**Rename.** The rename links the asset to the new symbol's instrument and takes
the portfolio's transactions on the old instrument along with it, in the same
serializable transaction. A symbol outside the catalog answers 404. A symbol the
portfolio already holds answers 400 without moving anything: the
`(portfolioId, instrumentId)` unique index refuses the write and the whole
transaction is undone, transactions included.

**Precision.** With `amount`, `price` and `balance` as `Float`, `BUY 0.3`,
`SELL 0.1`, `SELL 0.2` refused the last one because of rounding residue. The
columns became `DECIMAL(38,18)`, and the test that reproduced the defect started
protecting the fix. See [Reshaped transaction](#reshaped-transaction).

**Coverage added.**

* `src/routes/Transactions.integration.ts`: another user's transaction answers
  as non-existent on `GET`, `PATCH` and `DELETE`, changing neither the
  transaction nor the position; the listing only sees the caller's portfolio,
  including in a portfolio with more assets than one page.
* `src/routes/Assets.integration.ts`: a symbol outside the allowlist, the
  boundary of 100 on the page size and the rename (case, legacy symbol,
  allowlist, another portfolio's asset as non-existent, transactions taken
  along).
* `src/routes/Transactions.integration.ts`, the ledger: `BUY` adds to and
  `SELL` subtracts from the position; a `SELL` beyond the position is refused
  without storing; an edit replaces the impact instead of adding to it; an edit
  or deletion that would take the position below zero is refused changing
  nothing; of three concurrent `SELL`s over a position of 1, only one passes.
  Validation: a `type` in any case and with spaces is accepted, blank or
  unknown is refused without storing; an id that is not a UUID → 400 on `GET`,
  `PATCH` and `DELETE`.
* `src/config/App.integration.ts`: an unforeseen failure answers a generic 500,
  with no internal detail, and is logged exactly once.
* `src/routes/Authentication.integration.ts`: concurrent sign-ups for the same
  email, the first portfolio's name requested at sign-up, trimmed or refused
  when blank and above 60 characters, and account deletion (see
  [`authentication.md`](authentication.md)).

## Current transactions — TASK 3.4

`src/routes/Transactions.integration.ts` covers, through the HTTP API, the
creation, editing and deletion of `BUY` and `SELL` and the refusal for
insufficient balance. Most of it already existed from the fixes made after TASK
3.3 (ledger, ownership and validation, above). The task added what the scope was
missing:

* creation answers with the stored row, and the id's `GET` returns the same
  body;
* creating a transaction on another portfolio's asset answers as a non-existent
  asset, storing nothing and not moving the position;
* an edit that swaps `BUY` for `SELL` moves the position both ways;
* deleting a `SELL` gives back to the position what it had taken away;
* a `quantity` or `unitPrice` that is zero, negative or outside the decimal
  string format gets 400 on `POST` and `PATCH`, changing nothing. A JSON number
  is not converted, because the schema does no coercion.

**Known consistency bugs.** The baseline ones already fixed remain pinned down
by the tests that protect the fix: double counting on edit (#15), an unawaited
portfolio check on deletion (#16, first part), non-atomic writes (#17) and the
creation message on edit (#21). The ones that depended on the PHASE 4 reshaping
were reproduced by `todo` tests, following the TASK 3.3 convention, and none is
still `todo`.

The one about the cost of the units held after a `SELL` (baseline #18) passed
once `balance`, which added the purchase cost and subtracted the sale value,
gave way to `investedValue`, and it became an ordinary test: `BUY 10 @ 10` and
`SELL 5 @ 30` leave 5 units with `investedValue` 50, where `balance` came out
at −50. See [Position rebuilt from the ledger](#position-rebuilt-from-the-ledger).

The two `todo`s that compared the edited position and the position after
deletion against a recomputation of the sequence passed with the position
rebuilt from the ledger and became ordinary tests. See
[Position rebuilt from the ledger](#position-rebuilt-from-the-ledger).

The ones about a fractional sale down to zero and a cost above the largest
finite number passed with the reshaped transaction: the first became an
ordinary test, and the second gave way to the `DECIMAL(38,18)` ceiling tests.
See [Reshaped transaction](#reshaped-transaction).

**Recomputation as the reference.** The criteria of TASKS 4.7 and 4.8 compare
the position against the one the sequence of transactions would produce. The
tests store that sequence, through the API, on a second asset of the same
portfolio and compare the two positions, instead of pinning the expected value,
and that is why they went on holding when the position started being rebuilt
from the ledger. The fractional sequences were chosen because they diverged
under the incremental `double` arithmetic used before, which was checked before
they became a test.

**Open items.** What the task found without it being necessary to conclude the
task is in [`TODO.md`](../TODO.md): TD-002 (pagination of the transaction
listing). TD-001 (numeric type) and TD-009 (upper bound on `amount` and `price`)
were resolved by the [reshaped transaction](#reshaped-transaction).

## Instrument catalog

`src/routes/Instruments.integration.ts` covers the catalog through the HTTP
API:

* an admin registers an instrument, with symbol, type, market, currency and
  country normalized to upper case;
* the same symbol, in any case, does not produce a second instrument: 400
  `Instrument already exists in catalog`;
* a symbol outside the allowlist, a type outside the list, a currency that is
  not ISO 4217, a country that does not have two letters, a blank name or one
  above the limit and a market that is missing or outside the table get 400
  without storing;
* an admin completes an instrument's attributes, and the symbol sent in the body
  is ignored; a body with no attributes gets 400, and a symbol outside the
  catalog gets 404;
* a user who is not an admin gets 403 when registering or editing, leaving the
  catalog unchanged;
* any authenticated user lists the catalog, paginated and sorted by symbol;
* deleting the account of whoever holds an instrument removes the assets and
  keeps the instrument.

The asset and transaction suites started covering the same instrument in two
portfolios. Opening the asset in the second portfolio reuses the instrument, one
portfolio's ledger and count do not see the other's transactions, and deleting
the asset from one portfolio keeps the other's asset and transactions (TD-003).
Opening an asset or renaming to a symbol outside the catalog answers 404, and
renaming to a symbol the portfolio already holds answers 400 without moving
transactions.

**Migration.** The suite runs over the final schema and does not exercise the
migration of existing data. The catalog's was checked separately, over a
database with the previous migrations and data in the old format: it creates one
instrument per symbol, links assets and transactions with no loss, and aborts
before any change when a transaction without an asset exists.
`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`,
over the migrated test database, confirms that the migrations produce the
schema.

## Several portfolios per user

`src/routes/Portfolios.integration.ts` covers portfolios through the HTTP API:

* the caller creates a portfolio, with a `name` with no surrounding spaces and a
  `baseCurrency` in upper case; a name at the 60-character limit is accepted,
  and an invalid name or base currency gets 400 without storing;
* the listing brings only the caller's portfolios, in creation order, and splits
  into disjoint pages that cover the total, the last one partial; a caller with
  no portfolio gets the empty listing, and a page size outside the
  `PaginationQuerySchema` limits gets 400;
* the `GET` returns the caller's portfolio, another user's portfolio answers
  exactly like a non-existent one, and a `portfolioId` that is missing or not a
  UUID gets 400;
* a name repeated for the same owner, in any case or spacing, gets 409 with
  `details` on `name`, on creation and on rename, without storing; another user
  may use the name, the portfolio itself may change only the case of its name,
  and of three simultaneous creations with the same name in different cases
  exactly one passes. Repeated internal spaces collapse into one.

The asset and transaction suites gained a `portfolio scope` block: another
user's portfolio in `portfolioId` answers exactly like a non-existent portfolio,
and a `portfolioId` that is missing or not a UUID gets 400, changing neither
asset, transaction nor position. Two portfolios of the same user keep separate
positions on the same instrument, and a transaction by id, which carries no
portfolio in the route, is read, edited and deleted in any of the owner's
portfolios. `src/routes/Authentication.integration.ts` covers sign-up in the
chosen currency, the refusal of a missing or unknown base currency without
creating an account, and account deletion with every portfolio (see
[`authentication.md`](authentication.md)).

**Order.** The listing tests store the portfolios out of creation order, with
`createdAt` a day apart, so that the asserted order comes from the `ORDER BY`
and not from the insertion order.

**Migration.** Like the catalog's, the migration of existing data was checked
separately, over a database with the previous migrations and data in the old
format: the existing portfolio becomes `Main`, in BRL, with `createdAt` and
`updatedAt` equal to the user's registration date; a portfolio with no user
aborts the migration before any change; the unique index on `userId` becomes a
plain index, and a second portfolio for the same user is accepted.
`prisma migrate diff`, over the migrated test database, reports no difference.

**Unique-name migration.** `20260924000000_portfolio_name_key` was checked
separately, on 2026-09-24, over a database with the previous migrations and
repeated names: it normalizes the stored names as `normalizePortfolioName` does
(NFC, internal spaces collapsed, ends trimmed), writes `nameKey` with `lower()`
and renames each repetition for the same owner, from the second by `createdAt`
onwards, with the first free ` (n)` suffix — `main` and `MAIN` beside `Main` and
an already existing `Main (2)` became `main (3)` and `MAIN (4)` — cutting the
name to fit in 60 characters. The same name under different owners is left
intact. The test and production databases use `en_US.utf8`, where `lower()`
lowers accented letters as `toLowerCase()` does; in a database with the `C`
locale, `lower()` would lower ASCII only, and the key written by the migration
would diverge from the one the API computes for names with accents.
`prisma migrate diff`, over the migrated test database, reports no difference.

## Position rebuilt from the ledger

`Position` (table `positions`) keeps `quantity`, `averageCost` and
`investedValue`, and each portfolio has at most one position per instrument. The
routes and `AssetRepository` still speak of assets, and asset responses carry
the three fields in place of `amount`. The position assertions in
`src/routes/Transactions.integration.ts` and `src/routes/Assets.integration.ts`
check all three.

Uniqueness was already covered by the assets suite: a symbol the portfolio
already holds, in any case, answers 400, and two portfolios, of the same user or
not, have separate positions on the same instrument. The `ledger` block of
`src/routes/Transactions.integration.ts` started covering the rebuild:

* `BUY` weights the average cost by quantity and `SELL` keeps it: `BUY 10 @ 10`,
  `BUY 10 @ 20` and `SELL 5 @ 30` leave 15 units at 15;
* editing a `BUY` reprices the following rows, and so does deleting a `SELL`;
* an edit that leaves a later `SELL` above what the position holds at that point
  is refused changing nothing, even when the final quantity would still be
  positive;
* a position that reaches zero goes back to an average cost of zero.

`investedValue` is the cost of the units held, `quantity × averageCost`, and the
amount received on a sale does not enter it: `BUY 10 @ 10` and `SELL 5 @ 30`
leave `investedValue` at 50.

**Refusal without a write.** Creation, editing and deletion check the candidate
ledger in memory, with the new row at the point of its execution date, the
edited one reordered by the new date, or without the deleted one, and only store
when it is accepted, for the reason described in "Ledger and position in the
same transaction".

**Order.** The ledger is walked in `executedAt` order, then in recording order.
The test "replays entries executed and created at the same instant in recording
order, not id order" stores, with the same `executedAt` and `createdAt`, a `BUY`
with the id that sorts last and then a `SELL` with the one that sorts first, and
confirms that the next write to the position is accepted and rebuilds the
position in that order.

**Migration.** Checked separately, over a database with the previous migrations
and data in the old format: it renames `assets` to `positions`, with its primary
key and indexes; rebuilds each position's `quantity`, `averageCost` and
`balance` from its transactions, replacing the stored value when it diverges and
zeroing the position with no transactions; transactions at the same instant
follow id order; the result is equal, bit for bit, to the TypeScript rebuild,
fractional values included; a ledger that sells more than it holds aborts the
migration changing nothing. `prisma migrate diff`, over the migrated test
database, reports no difference.

**Cost migration.** Checked separately, over a database with the previous
migrations and stored positions: it renames `balance` to `investedValue`, with
the schema's type, nullability and default; writes `quantity × averageCost`
truncated at 18 places, including in a position with a negative `balance` after
a sale above cost, with a fractional average cost and at the column's ceiling;
and aborts changing nothing when some product does not fit in `DECIMAL(38,18)`.
`prisma migrate diff`, over the migrated test database, reports no difference.

## Reshaped transaction

`Transaction` stores `quantity`, `unitPrice`, `fees`, `taxes`, `currency`,
`executedAt`, `broker` and `notes`, and `type` is the `TransactionType` enum.
Transaction and position quantities and values are `DECIMAL(38,18)` and travel
as decimal strings. The fixtures store strings and share `FIXTURE_EXECUTED_AT`,
so the ledger order among them falls back to recording order. The tests compare
decimals by the string from `toFixed()`, because `Prisma.Decimal`'s `toJSON`
uses an exponent for small values.

The `ledger` block of `src/routes/Transactions.integration.ts` started covering:

* selling a fractional position down to exactly zero;
* fees and taxes in the purchase cost, with the average cost truncated at 18
  places;
* small values returned in plain notation, with no exponent;
* a transaction in a currency different from the position's others refused with
  `CURRENCY_MISMATCH`, without storing;
* a backdated `BUY` entering the ledger by its execution date and repricing the
  position;
* a `SELL` executed before the purchase that would cover it refused, on creation
  and on the edit that moves it before that purchase;
* `DIVIDEND`, `JCP` and `INTEREST` stored without moving the position, and
  `BONUS` adding units at the attributed cost, zero included;
* a position at the `DECIMAL(38,18)` ceiling accepted, and the write that would
  pass it, in quantity or in `investedValue`, refused with
  `POSITION_OUT_OF_RANGE`.

The validation block covers, on `POST` and `PATCH`, without storing or moving
the position: a type that is blank, unknown or not yet accepted by the API
(`SPLIT`); a decimal as a `number`, negative, with an exponent, with a leading
zero, with a dot and no places, with spaces, empty, with 21 integer digits or 19
places, and zero in `quantity` and in `unitPrice`, the latter on every type but
`BONUS`, with `unitPrice` as the detail's `path`; a `currency` that is missing
or outside ISO 4217; an `executedAt` that is missing, without a time, without a
zone or in another format; a `broker` and `notes` above the limit. One test
checks that creation stores each field as sent, with an `executedAt` sent with a
zone returned in UTC, and that editing replaces them all, taking the omitted
optional ones back to their default.

**Migration.** Checked separately, over a database with the previous migrations
and data in the old format: no transaction lost; `amount` and `price` converted
by each `double`'s shortest decimal representation (`0.1` and `0.2` add up to
exactly `0.3`, and `BUY 0.3`, `SELL 0.1`, `SELL 0.2` zero the position);
`currency` from each portfolio's base currency and `executedAt = createdAt`;
positions rebuilt in decimal, with the average cost truncated at 18 places;
columns, nullability and enum as in the schema; the temporary table removed. It
aborts changing nothing on a type outside the enum, a transaction with no
portfolio, an `amount` or `price` that is zero, negative, with more than 18
places or from 10²⁰ up, a ledger that sells more than it holds, a `DIVIDEND` in
the ledger and a ledger that passes through a position outside the column, even
if it ends inside it. `prisma migrate diff`, over the migrated test database,
reports no difference.

**`JCP` migration.** It only adds the value to the `TransactionType` enum, after
`DIVIDEND`, without touching a stored row. `prisma migrate diff`, over the
migrated test database, reports no difference.

## Deterministic position rebuild

`rebuildPosition`, in `src/domain/PositionLedger.ts`, rebuilds the position from
the ledger with no IO; `TransactionRepository` reads the position's
transactions, hands over the candidate ledger and stores the result.
`src/domain/PositionLedger.test.ts` covers it in the unit band:

* `BUY` weights the average cost with fees and taxes, and `investedValue` is
  `quantity × averageCost`;
* `SELL` keeps the average cost and zeroes it when nothing is left;
* average cost and `investedValue` truncated at 18 places;
* the 24 permutations of a four-transaction ledger rebuild the same position;
* transactions with the same `executedAt` follow recording order, and the one
  not yet stored comes last;
* `BONUS` adds quantity and attributed cost, zero included;
* `DIVIDEND`, `JCP` and `INTEREST` change neither quantity nor cost, with or
  without units held, and in another currency they refuse the ledger;
* refused: a `SELL` before the purchase that would cover it, a ledger with two
  currencies, a ledger that passes through a position outside the column, and an
  `investedValue` outside the column with every other value inside it;
* a type the rebuild does not implement (`SPLIT`) throws;
* `realizeProfitLoss` realizes each sale at the average cost before it, with the
  same result across the 24 permutations of buy, sell, buy again and sell;
  truncates each sale at 18 places; and returns the replay's refusal.

`src/domain/PositionIndicators.test.ts` covers `describePositionIndicators` with
a fixed instant: each window's change against the last close on or before its
first day, with closes out of order and outside midnight; the low and the high
from the last year only, without the close read before it; `openedOn` beside
each `change`; `closes` from the start of the year, without the close read
before it, or from the first close when the history is shorter; one close per
day, the most recent one, when more than one source observed the day, in the
low, the high, the change and the series; the window the history does not reach,
the one the most recent close does not reach and the one that opens at zero with
no `change`; no price indicator without a close in the last year; each sale's
realized result, income net of fees and taxes, the last year's income, the
`yieldOnCost` and the `since` with the ledger out of order; a realized loss
without `yieldOnCost` when nothing is invested; and a ledger that does not
rebuild throws. The `indicators` block of
`src/routes/Portfolios.integration.ts` covers the route against the database,
with closes seeded relative to the current day: price, with `openedOn` and the
series since the start of the year, and the return of a position with a
purchase, a sale and a dividend; a position with neither transaction nor close
with an empty body; a symbol outside the portfolio with 404, without reading
history; another user's portfolio with 404 and a missing `portfolioId` with 400.
The `YTD` change is left out of the integration assertion, because in the first
three days of January the seeded closes fall on its first day; the unit test
covers it with a fixed date.

`src/domain/Fundamentals.test.ts` covers `fundamentalMetricsOf` and
`describeFundamentals`: a stock's eight metrics in display order, those of a
REIT and of a fund, none for crypto, bonds, Treasury, cash and other, and one
figure per requested metric, in the requested order, with no value when the
source does not report it. The `fundamentals` block of
`src/routes/Portfolios.integration.ts` swaps the singleton's `getFundamentals`
for a `FakeMarketDataProvider`: a stock's figures in order, with the source; a
crypto position `not-applicable` without calling the provider; `not-found` and
then `unavailable` by swapping the fake mid-test; a symbol outside the portfolio
with 404; another user's portfolio with 404 and an invalid query with 400.

**Recording order.** `Transaction.sequence` is a unique `BIGINT`, filled in by
the database on insertion and never returned by the API. `createTransaction`
accepts `id` and `createdAt`, which makes it possible to store transactions at
the same instant with ids in the opposite order to the recording order.

**Migration.** Checked separately, over a database with the previous migrations:
it numbers the existing transactions in `createdAt`, `id` order, across
positions; on an empty table, the first insertion gets 1; the next insertion
continues from the highest number; the column is a non-null `bigint`, with the
default from the sequence it owns, and the unique index refuses a repeated
number. `prisma migrate diff`, over the migrated test database, reports no
difference.

## Transaction deletion

`TransactionRepository.delete` rebuilds the position from the remaining
transactions and stores the deletion and the position in the same serializable
transaction. Besides the deletion tests in the `ledger` block (giving back what
a `SELL` took away, repricing the following rows, refusing to delete a `BUY` a
`SELL` depends on), two cover the deletion's consistency:

* "leaves a position after a deletion equal to replaying the remaining
  transactions" deletes a `BUY` from the middle of a ledger with fees, taxes and
  a later `SELL` and `BUY`, and compares the position against the one obtained
  by storing only the remaining transactions into an empty position. In that
  ledger, removing the deleted row's impact by delta would give a different
  average cost.
* "rolls back the deletion when writing the position fails, keeping the
  transaction" removes the position directly in the database, so that writing it
  fails after the row has been deleted, and confirms the 500 response with the
  transaction still stored.

## Atomicity of financial operations

Creating, editing and deleting a transaction, renaming an asset, deleting an
asset and deleting an account write to more than one table inside a single
`runSerializable` (see "Ledger and position in the same transaction"). For each
one, a test makes the last write fail, after the previous ones, and confirms the
generic 500 response with the previous state intact:

* transaction creation: writing the position fails after the insertion; the
  ledger keeps only the previous transactions and the position does not change;
* transaction editing: writing the position fails after the change; the
  transaction stays as stored and the position does not change;
* transaction deletion: the test in
  [Transaction deletion](#transaction-deletion);
* asset rename: the unique-index test, described under "Rename";
* asset deletion: removing the position fails after the transactions are
  removed; position and transactions remain stored;
* account deletion: removing the user fails after transactions, positions and
  portfolios are removed; all four tables keep the account's rows.

The last write is the one with the most previous writes to undo; a failure at an
earlier step interrupts the operation before the following ones.

**Injected failure.** Creation, editing, asset deletion and account deletion
have no natural failure in the last write. `injectWriteFailure(t, model,
action)`, in `src/test/TestDatabase.ts`, makes `model.action` reject inside
`runSerializable`'s real transaction until the end of the test, and the other
queries proceed normally, so what the test observes is Postgres's rollback. The
failure is unforeseen: it goes out through the error handler as a 500 and is
logged, and the test silences `console.error`. The harness test checks that only
the chosen write fails and that the previous one is undone, so that a helper
failing before the first write would not let the rollback tests pass without
undoing anything.

## Fake quote provider

No test calls a real quote provider. `src/test/FakeMarketDataProvider.ts`
implements `MarketDataProvider` over the prices it receives in the constructor,
by symbol, and returns each one with `source` `fake`; with
`isAvailable: false`, every lookup answers `unavailable`. Fundamentals are
seeded separately, in the `fundamentals` option, by symbol; the fake returns
only the requested metrics, and a symbol with no seeded fundamentals answers
`not-found`. Each test creates its own and hands it to the code that takes a
`MarketDataProvider`, with no shared mutable state. The constructor requires at
least one price per symbol, so a symbol with no price is one outside the map and
answers `not-found`. An exchange rate is seeded under the pair's codes, such as
`USDBRL` for one dollar in reais, and the previous close goes in the price
itself, in `previousClose`.

The fake ignores market, currency and interval: translating the instrument and
respecting each interval's reach is the real adapter's job.

`src/test/FakeMarketDataProvider.test.ts` checks in the unit band the contract
the tests lean on: the most recent quote in any load order, history in ascending
order, the interval's start included and its end excluded, an empty interval, a
symbol with no price, an exchange rate by pair, fundamentals limited to the
requested metrics, and unavailability. `tsconfig.build.json` excludes
`src/test`, so the fake does not enter the build.

## Yahoo Finance adapter

`src/infra/market-data/YahooFinanceProvider.test.ts` runs in the unit band,
without network: the constructor receives `fetchResponse` and `now`, and each
test creates its own provider, with its own responses and clock. It covers:

* translation by market (`PETR4.SA`, `AAPL`, `KO`, `BTC-USD`) in a single
  request, with the key only in the `x-api-key` header, never in the URL, a
  refused redirect and a timeout;
* an instrument from a market outside the table, with no market or currency, or
  with a symbol outside letters and digits answers `not-found` with no request;
* a symbol missing from the response answers `not-found` and is cached;
* caching for `QUOTE_TIME_TO_LIVE_MS` and a new request when it expires; a
  simultaneous lookup of one symbol reuses the request in flight; batches of at
  most `QUOTE_BATCH_SIZE` symbols;
* with no key, every quote answers `unavailable` with no request;
* an error status, a timeout and a network failure answer `unavailable`, open
  the `FAILURE_COOLDOWN_MS` pause and do not record the key; during the failure,
  the last quote received is returned with the `timestamp` at which it was
  observed;
* a response outside the format and an invalid quote (a currency in a minor
  unit, such as `BRp`, a negative price or one outside `DECIMAL(38,18)`, a
  missing time) answer `unavailable`, without affecting the valid ones in the
  same batch;
* the previous close rounded like the price, and discarded when invalid without
  refusing the quote;
* exchange: the `USDBRL=X` pair in the quote cache, an invalid code or one equal
  to the base as `not-found` with no request, a rate quoted in a currency
  different from the base as `unavailable`, and a pause shared with the quote
  failure;
* history: the request's `period1`, `period2` and `interval`, null closes
  discarded, a half-open interval in ascending order, `range-not-served` with no
  request for a start beyond the interval's reach, an empty interval, 404 as
  `not-found` and a series with diverging lengths as `unavailable`;
* history caching: an empty window and a 404 answered with no request until
  `EMPTY_HISTORY_TIME_TO_LIVE_MS` and requested again when it expires; a window
  with a price, and a failure, requested again; a simultaneous lookup of the
  same window reusing the request in flight; at most
  `EMPTY_HISTORY_CACHE_MAX_ENTRIES` windows, discarding the oldest;
* fundamentals: the metrics read from `financialData` and `summaryDetail`, with
  a number in `{raw}` or bare, `debtToEquity` from a percentage to a multiple,
  and the requested modules, `summaryDetail` alone for a fund's yield, read from
  `yield`; a figure outside the format is left out, and so is cash flow in a
  minor-unit currency, such as `GBp`; caching for
  `FUNDAMENTALS_TIME_TO_LIVE_MS`, with the response and the 404; an instrument
  with no translation as `not-found` with no request; an error status and an
  invalid format answer `unavailable`, are requested again and do not pause the
  quotes.

The test mirrors at the top the adapter constants it depends on.

## Valuation

`src/domain/PositionValuation.test.ts`, in the unit band, covers
`valuePosition`: market value with profit and percentage; truncation toward zero
in the product and in the quotient; values at the `DECIMAL(38,18)` limits with
no digit loss; `profitLoss` absent with a ledger in another currency or with no
transactions; percentage absent with no invested value; `not-found` and
`unavailable` passed through.

`GET /v1/assets/valuations`, which valued a portfolio's requested symbols, was
removed along with the suite that covered it; the positions table reads
`GET /v1/portfolio/positions`. The `unavailable` response with no provider key,
with no call to `fetch` at all, is pinned down in the adapter, in
`src/infra/market-data/YahooFinanceProvider.test.ts`.

`src/domain/PortfolioValuation.test.ts`, in the unit band, covers
`summarizePortfolio`: the sum in the base currency with the result and the day's
change; conversion at the rate of the quote's currency and of the transactions'
currency; truncation toward zero in the totals and percentages, including in a
negative change; totals at the `DECIMAL(38,18)` limits with no digit loss;
indicators absent with no quote, no rate, no cost currency or no previous close;
a position with no units ignored; an empty portfolio with zero totals. It also
covers `valuePositionsInBaseCurrency`: each position in the base currency with
its allocation; allocation over the whole portfolio when only part of it is
listed; truncation of price, value and fraction; a position at the
`DECIMAL(38,18)` limits with no digit loss; fields absent with no quote or no
rate; cost with no currency; a position with no units with zero value and
allocation; a portfolio worth zero at the scale with no allocation. It further
covers `allocatePortfolio`: distribution by asset, type, sector and currency
without the position with no units, with sector `null` last; in each group, the
sum of its positions' truncated values and fractions, with every distribution
within tolerance over `totalValue` and over 1; the quote's currency in place of
the catalog's, and the catalog's when there is no quote; total, fractions and
the group's value absent with no quote or no rate; a portfolio with no positions
with units worth zero and with empty distributions; a portfolio worth zero at
the scale with no allocation. It covers `matchesPositionFilter`: every position
with no criterion; search without distinguishing case in symbol and name; class;
status, with the smallest representable quantity as held and a quantity of zero
as closed; and the criteria combined. And `sortPositionsBy`: decimal
comparison, not lexicographic, both ways, with the position missing the value
last in both, and ties in the order received. And `foreignCurrenciesOf`, with
each currency other than the base once. And `describePosition`: the position in
the base currency beside the catalog and the quote in the quote's currency, with
the day's change and percentage; truncation toward zero of both; with no
previous close, neither change nor percentage; a previous close of zero, with no
percentage; and, with no quote, only the position's and the catalog's fields.

The `overview` block of `src/routes/Portfolios.integration.ts` covers
`GET /v1/portfolio/overview`, swapping the singleton's `getQuotes` and
`getExchangeRates` for a `FakeMarketDataProvider`: the requested portfolio's
indicators, without another portfolio of the same user's positions and without
the position with no units, with exchange requested only for the foreign
currency; the indicators that depend on a quote left out of the body with the
provider unavailable; an empty portfolio in its base currency, with
`heldPositionCount` `0`, and the count of positions with units in the others;
another user's portfolio the same as a non-existent one; a `portfolioId` that is
missing or malformed with 400.

The `positions` block of the same file covers `GET /v1/portfolio/positions` with
the same swap: the requested portfolio's positions in `symbol` order and in the
base currency, with the position with no units and without another portfolio of
the same user's, and exchange requested only for the foreign currency; the last
page and a page beyond it with the same totals, quoting outside the page only
the positions with units; descending `symbol` order, with the same quote;
ordering by a value both ways before paginating, with the position missing the
value last and every filtered position quoted; search by symbol and name
without distinguishing case, class and status, alone and combined, with `total`
and `totalPages` covering only the filtered positions and a search with no match
as an empty page; items without the fields that depend on a quote with the
provider unavailable; an empty portfolio as an empty page at the largest
`pageSize`; another user's portfolio the same as a non-existent one; a
`portfolioId`, `page`, `pageSize`, `sortBy`, `sortOrder`, `search`, `type` or
`status` that is missing, malformed or outside the limits with 400.

The `by symbol` block, inside `positions`, covers
`GET /v1/portfolio/positions/:symbol` with the same swap: the position by symbol
without distinguishing case, with catalog, quote and the day's change, also
quoting the other positions with units and requesting exchange only for the
foreign currency; the position with no units, quoted beside those with units;
the position with no quote and without the fields that depend on it with the
provider unavailable; a symbol with no position in the requested portfolio,
including one from another portfolio of the same user, with 404 and without
consulting the provider; small values returned in plain notation, with no
exponent; another user's portfolio the same as a non-existent one; a
`portfolioId` that is missing or malformed and a symbol that is empty or too
long with 400.

The `allocation` block of the same file covers `GET /v1/portfolio/allocation`
with the same swap: the requested portfolio's distribution by asset, type,
sector and currency, in the base currency, without the position with no units
and without another portfolio of the same user's, quoting only the positions
with units and requesting exchange only for the foreign currency; groups with
neither values nor fractions with the provider unavailable; an empty portfolio
in its base currency, worth zero and with empty distributions; another user's
portfolio the same as a non-existent one; a `portfolioId` that is missing or
malformed with 400.

`node --env-file` does not overwrite a variable already exported in the shell,
so no test depends on `.env.test` omitting `YAHOO_FINANCE_API_KEY`: no route
reaches the singleton's `getQuotes` or `getExchangeRates` with a quotable
instrument or currency without the test swapping them.

## Error body

`src/config/App.integration.ts` pins down the `{ code, message, details }` body
([Response shape](api-inventory.md#response-shape)) on a non-existent route
(404), on a payload above the limit (413), on malformed JSON (400), on the rate
limit (429) and on an unforeseen failure (500), with `details` empty. A payload
the schema refuses answers 400 with one `{ path, message }` per refused field in
`details`.

## Transaction listing

The `listing` block of `src/routes/Transactions.integration.ts` covers
`GET /v1/transactions`: the requested portfolio's transactions from the most
recent to the oldest, with recording order breaking ties on the same
`executedAt`, each item with the transaction's fields and the instrument's
`symbol`, without another portfolio of the same user's; filters by `symbol` and
`type` in any case, by `broker` equal to the stored value, with a different
case, `%` and `_` with no match, and by `dateFrom` and `dateTo` inclusive and in
any zone, combined, inverted and with no match; pages that neither repeat nor
skip a transaction, and a page beyond the last, up to the largest the schema
accepts, with an empty `items` and the same totals; a malformed filter or page
with 400. The `portfolio scope` block includes the endpoint, and the tests that
listed by symbol, in the transaction and asset suites, started filtering by
`symbol`.

## Stored quotes

`src/domain/PriceHistory.test.ts` covers, without a database, what is left to
fetch from a series: the instant taken to the start of its day in UTC; the whole
interval when nothing is stored; nothing to request when the closes reach the
current day; each edge on its own and both together; the day with no trading
between the extremes, which is never requested again; the interval that ends in
the past, preserved whole; and the interval restricted to the current day, which
requests nothing. Now is a parameter, never `new Date()` inside the test.

`src/services/market-data/GetPriceHistoryService.integration.ts` covers the
orchestration against the database, with a fixed clock and the
`FakeMarketDataProvider`'s `getHistoricalPrices` replaced by `t.mock.method` in
each case: what is requested from the provider excludes the current day and
arrives with the daily interval; a series that already reaches the current day
does not call the provider; only the days after the newest close are requested;
a provider that does not answer returns what is stored; and a symbol outside the
catalog is refused with `NotFoundError`.

`src/infra/database/MarketQuoteRepository.integration.ts` is the first
repository integration suite: it brings up neither the API nor the HTTP client,
and checks through `PrismaClient` what the table keeps, with
`registerIntegrationHooks` and the instrument from `createInstrument`. It covers
`recordDailyCloses`: one row per trading day, with the instant at the start of
the day in UTC, the exact decimal and the row's instrument; a day already stored
by the same source keeping the first observed price, with the return counting
only the new days; the same day from another source as a row of its own; and an
empty list storing nothing.

## Portfolio performance

`src/domain/PortfolioPerformance.test.ts` covers, without a database, the
window resolution and the series: whole months back from the start of the
current day in UTC, `YTD`'s current year, the day of `MAX`'s first transaction
and the empty window of a ledger with no transaction; the position valued at
each close, with a zero return at the first point; the day's contribution, which
does not count as a gain; the net income paid on the day counted as a return;
the `BONUS` units with no contribution; the position quoted in another currency
taken to the base currency at the day's rate; the day with no rate and the day
with no close for some held position, both out of the series; the benchmark over
the window's first close; and the portfolio with nothing quotable, with an empty
series. Now is a parameter, never `new Date()` inside the test.

The `performance` block of `src/routes/Portfolios.integration.ts` covers
`GET /v1/portfolio/performance` against the database, swapping the singleton's
`getHistoricalPrices` and `getHistoricalExchangeRate` for `t.mock.method`, as
the other routes swap the quote: the requested portfolio's series in the base
currency, with the window that reached the provider; the position in a foreign
currency converted at each day's rate, with the pair requested once; the
benchmark beside the portfolio; a benchmark outside the catalog with 404; the
series of a single position, by symbol without distinguishing case, without
fetching the others' closes or exchange; a symbol with no position in the
portfolio with 404; a portfolio with no transaction as an empty window; another
user's portfolio the same as a non-existent one; and a `portfolioId`, `range`,
`benchmark` or `symbol` that is missing or malformed with 400. The closes are
seeded relative to the current day, not on fixed dates, which the suite would
leave behind.
