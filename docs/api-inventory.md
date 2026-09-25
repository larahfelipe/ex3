# Route and contract inventory

A catalog of the API's state captured at commit `8dc9edd`, kept as a baseline;
what has ceased to hold since then is in
[Superseded since the snapshot](#superseded-since-the-snapshot). Two HTTP layers
coexist:

* **Express backend** (`backend/src/routes`) — the domain API, authenticated by
  `Authorization: Bearer <jwt>`.
* **Next.js proxy** (`web/src/app/api/v1`) — Route Handlers consumed by the
  browser; they read the JWT from the `httpOnly` cookie `ex3:token` and forward
  it to the backend. The browser never talks to the backend directly.

## Conventions at the time

**Authentication (backend).** `authMiddleware` requires
`Authorization: Bearer <token>`, verifies the signature with `JWT_SECRET` and
**also** requires the token to be stored in `users.accessToken`. A valid token
whose row was overwritten by another login stops authenticating — there is no
concurrent session.

**Errors (backend).** Each controller catches its own exception and answers
`{ name, message }` with the `ApplicationError`'s status; an unknown error falls
into the default `500 InternalServerError`. There is no stable `code` and no
`details`. There is no global error handler.

**Errors (proxy).** `ApiProxyError` → `{ message, _error? }` with the status and
statusText propagated from the backend.

**Pagination.** `assets` and `transactions` return
`{ page, limit, total, totalPages }`; `transactions` adds `lastId`. No other
endpoint paginates. The `page`/`limit` defaults live in the repository, not in
the schema.

**Side effects.** No operation is atomic: writing `transactions` and updating
`assets` are independent calls to Prisma.

---

## Backend — Users

| Method | Path | Auth | Payload | Response 2xx | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/v1/user` | no | `{ email, password }` (`GetUserSchema`) | `200` `{ id, name, email, accessToken, createdAt, updatedAt }` | `400` invalid payload · `404` `User not found` — **also** when the password is wrong, which avoids user enumeration but uses a semantically incorrect status |
| POST | `/v1/user/create` | no | `{ name?, email, password }` (`CreateUserSchema`) | `201` `{ user, message: 'User created successfully' }` | `400` · `409`/`400` `User already exists` |
| GET | `/v1/users` | yes | — | `200` `{ users }` | `401` · `403` if `!user.isAdmin` |
| POST | `/v1/user/sign-out` | yes | — | `200` `{ message }` | `401` |
| PATCH | `/v1/user` | yes | `{ name?, oldPassword?, newPassword? }` | `200` `{ user, message }` | `400` invalid payload and `Invalid password`, the latter without `details` · `401` without a session |
| DELETE | `/v1/user` | yes | `{ password }` | `200` `{ message }` | `400` · `401` |

**Relevant side effect:** `POST /v1/user` (sign-in) issues a new JWT and
**overwrites** `users.accessToken`, invalidating the previous session.
`POST /v1/user/create` creates the user's `Portfolio` in the same flow (1:1).

**Contract note:** sign-in is a `POST /v1/user`, semantically a read. A
divergence to resolve in PHASE 6.

---

## Backend — Portfolios

| Method | Path | Auth | Payload | Response 2xx | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/v1/portfolio` | yes | — | `200` `Omit<Portfolio,'assets'>` | `401` · `404` `Portfolio not found for this user` |
| GET | `/v1/portfolios` | yes | — | `200` `{ portfolios }` | `401` · `403` if `!user.isAdmin` |

No pagination and no filters. A user has at most one portfolio
(`Portfolio.userId @unique`).

---

## Backend — Assets

| Method | Path | Auth | Payload | Response 2xx | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/v1/asset/:symbol` | yes | param `symbol` (1–6 chars, upper) | `200` `Asset` | `400` · `401` · `404` `Asset not found in portfolio` |
| GET | `/v1/assets` | yes | query `page?`, `limit?`, `sort?` (`asc`\|`desc`) | `200` `{ assets, pagination, sort? }` | `400` · `401` · `404` `Portfolio not found` |
| POST | `/v1/asset` | yes | `{ symbol }` | `201` `{ asset, message }` | `400` · `401` · `404` portfolio · conflict `Asset already exists in portfolio` |
| PATCH | `/v1/asset/:symbol` | yes | param `symbol` + body `{ newSymbol }` | `200` `{ asset, message }` | `400` · `401` · `404` |
| DELETE | `/v1/asset/:symbol` | yes | param `symbol` | `200` `{ message }` | `400` · `401` · `404` |

**Filters:** ordering (`sort`) only, by a fixed field defined in the repository.
There is no server-side search by symbol.

**Side effects:** `DELETE` removes the asset and its transactions in a logical
cascade. `PATCH` renames the symbol, which is the foreign key of
`transactions.assetSymbol`.

**Constraint inherited from the schema:** `assets.symbol` is globally `@unique`
— `PETR4` can exist in a single portfolio across the whole database.

---

## Backend — Transactions

| Method | Path | Auth | Payload | Response 2xx | Errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/v1/transaction/:id` | yes | param `id` | `200` `Transaction` | `400` · `404` `Transaction not found for this asset` |
| GET | `/v1/transactions/:assetSymbol` | yes | param `assetSymbol` + query `page?`, `limit?`, `lastId?` | `200` `{ transactions, pagination: { page, limit, total, totalPages, lastId } }` | `400` · `401` · `404` |
| GET | `/v1/transactions/:assetSymbol/count` | yes | param `assetSymbol` | `200` `{ buy, sell }` | `400` · `401` · `404` |
| POST | `/v1/transaction` | yes | `{ type: 'BUY'\|'SELL', amount>0, price>0, assetSymbol }` | `201` `{ transaction, message }` | `400` payload or `resulting amount cannot be negative` · `401` · `404` |
| PATCH | `/v1/transaction/:id` | yes | param `id` + body `{ type, amount, price }` | `200` `{ message }` | `400` · `401` · `404` |
| DELETE | `/v1/transaction/:id` | yes | param `id` | `200` `{ message }` | `400` · `401` · `404` |

**`GET /v1/transaction/:id` does not check ownership.** The service receives
only `id`; any authenticated user reads any other user's transaction. An
authorization failure to fix in PHASE 6.

**Side effects and known defects:**

* `POST` stores the transaction and then applies `increment`/`decrement` to
  `assets.amount` and `assets.balance`, with no database transaction.
* `PATCH` applies the new impact **without reverting the previous one** — double
  counting. It also answers with the message
  `'Transaction created successfully'`.
* `DELETE` reverts by delta from the transaction's original values, without
  recomputing the position from the remaining ledger; and the portfolio check
  does not use `await`, so it is always true.
* There are no types beyond `BUY`/`SELL`: income, contributions and splits are
  not representable.
* `executedAt` does not exist — the operation's date is `createdAt`.

---

## Next.js proxy

| Method | Path | Auth | Behaviour |
| --- | --- | --- | --- |
| POST | `/api/v1/sign-up` | no | forwards to `POST /v1/user/create` |
| POST | `/api/v1/sign-in` | no | forwards to `POST /v1/user`; stores `accessToken` in the `ex3:token` cookie (`httpOnly`, `sameSite: strict`, `secure` in production) and the `ex3:session` marker; returns the user without the token |
| POST | `/api/v1/sign-out` | cookie | forwards to `POST /v1/user/sign-out` to revoke the session on the server and then clears the token cookie and the `ex3:session` marker; the cookies are cleared even if the API fails |
| POST | `/api/v1/session/expire` | cookie | does not call the API; clears the token cookie, keeps the marker and returns `{ hasSessionExpired }`, true if there was a token or a marker. It is what the interceptor calls after a 401 |
| GET | `/api/v1/assets` | cookie | forwards to `GET /v1/assets`; **sums `totalBalance` and computes `dominance` per asset in the proxy** |
| POST | `/api/v1/assets/create` | cookie | forwards to `POST /v1/asset` |
| GET/PATCH/DELETE | `/api/v1/assets/[symbol]` | cookie | forwards to `/v1/asset/:symbol` |
| GET | `/api/v1/transactions/[symbol]` | cookie | forwards to `GET /v1/transactions/:assetSymbol` |
| GET | `/api/v1/transactions/[symbol]/count` | cookie | forwards to `GET /v1/transactions/:assetSymbol/count` |
| POST | `/api/v1/transactions/create` | cookie | forwards to `POST /v1/transaction` |

**Not covered by the proxy:** transaction `PATCH`/`DELETE`, `/v1/portfolio`,
`/v1/portfolios`, `/v1/users`, user `PATCH`/`DELETE`. The account screen and
transaction editing have no corresponding proxy route.

**A financial rule in the proxy:** `totalBalance` and `dominance` are computed
in `web/src/app/api/v1/assets/route.ts`. It violates guideline 4 of the plan and
will be removed in PHASE 5/6.

---

## Classification

Every route (17 backend + 9 proxy) is classified above. No route in the
repository was left without an entry.

| Destination in the evolution | Routes |
| --- | --- |
| Preserve with a contract adjustment | sign-in, sign-up, sign-out, users CRUD |
| Replace with product endpoints (PHASE 6) | `/v1/assets`, `/v1/asset/:symbol`, `/v1/portfolio` |
| Reshape over the new domain (PHASE 4) | every transaction route |
| Fix authorization before any reuse | `GET /v1/transaction/:id` |
| Create | overview, positions, performance, allocation, income |

---

## Response shape

The contract of every API error response and of every new endpoint that lists.

**Error.** The body is `{ code, message, details }`, including in the `404` of a
non-existent route and in the `429` of the rate limit.

* `code` — one of the eight `ErrorCategories`
  (`backend/src/config/Constants.ts`): `VALIDATION` (400 and 413),
  `AUTHENTICATION` (401), `AUTHORIZATION` (403), `NOT_FOUND` (404), `CONFLICT`
  (409), `DOMAIN` (422), `INFRASTRUCTURE` (429 and 503), `INTERNAL` (500).
  Category and status are distinct axes, and the code is stable across versions.
  See [`errors.md`](errors.md).
* `message` — display text; in a validation error, the messages of the refused
  fields separated by commas.
* `details` — always present. In a validation error, one `{ path, message }` per
  refused field, with `path` in dot notation (a list index as a segment) and
  empty when the problem is the whole body; in every other error, `[]`. It
  carries no stack, SQL or other internal detail.

The web's proxy keeps `{ message, _error }`, with the API's body in `_error`.

**Paginated listing.** Query `page`, an integer from 1 up with a default of 1,
and `pageSize`, an integer from 1 to 100 (`Pagination.MAX_SIZE`) with a default
of 10 (`Pagination.DEFAULT_SIZE`). Response
`{ items, page, pageSize, total, totalPages }`, with
`totalPages = ⌈total / pageSize⌉`, zero when there are no items; a page beyond
the last answers with an empty `items` and the same totals. Each listing's
ordering is explicit and documented with the endpoint. `GET /v1/portfolios` and
`GET /v1/instruments` predate the standard and still use `limit` and
`pagination` (TD-021).

---

## Superseded since the snapshot

| In the snapshot | Today | Reference |
| --- | --- | --- |
| The session validated against the token stored in `users.accessToken` | The `sessionVersion` claim compared against `users.sessionVersion`, in a token with an expiry | [`authentication.md`](authentication.md) |
| Sign-in answers `404 User not found`, also for a wrong password | `401 Invalid email or password`, identical for a non-existent email | [`authentication.md`](authentication.md) |
| Each controller catches its own exception; there is no global error handler | The controllers propagate and `errorHandlerMiddleware` answers `{ code, message, details }`; an unforeseen error becomes a generic `500` and is logged. A non-existent route and the rate limit answer in the same format ([Response shape](#response-shape)) | `backend/src/middleware/ErrorHandlerMiddleware.ts` |
| The `page`/`limit` defaults live in the repository, with no validation | `page` and `limit` are positive integers and `limit` goes up to 100, validated in the schema, which also applies the `Pagination.FIRST_PAGE` and `Pagination.DEFAULT_SIZE` defaults (`backend/src/config/Constants.ts`) | `backend/src/validation/schema/PaginationQuerySchema.ts` |
| No operation is atomic | Sign-up creates the user and the portfolio in the same database transaction. A transaction write (the ledger row and the asset's position), portfolio editing and deletion, asset deletion and account deletion each run in a serializable transaction, and a failure at any step undoes the whole operation | `backend/src/infra/database/PrismaClient.ts`, [`testing.md`](testing.md) |
| `PATCH /v1/transaction/:id` adds the new impact to the position without undoing the previous one and answers `Transaction created` | It rebuilds the position from the ledger, with the edited row in place of the original, and answers `Transaction updated` | [`testing.md`](testing.md) |
| Only the `SELL` is compared against the position, and deletion does not compare | Creation, editing and deletion refuse with `400`, without storing, the ledger in which some `SELL` would sell more than the position holds at that point, including deleting a `BUY` a `SELL` depends on | [`testing.md`](testing.md) |
| A transaction id is any non-empty string; an invalid id answers `404` | A UUID validated in the schema; an invalid id answers `400` | `backend/src/validation/schema/transaction/TransactionIdSchema.ts` |
| `DELETE /v1/user` on an account with assets answers `500` | It removes the account, portfolios, assets and transactions in the same transaction | [`authentication.md`](authentication.md) |
| `symbol` of 1–6 characters, in upper case | Normalized (`trim`, upper case) ahead of the limits; a new symbol accepts letters and digits only | `backend/src/validation/schema/asset/AssetSymbolSchema.ts` |
| A missing asset on `PATCH`/`DELETE` answered `400` | `404`, as on `GET` | [`testing.md`](testing.md) |
| `GET /v1/transaction/:id` does not check ownership; the `DELETE` checks the portfolio without `await` | Every transaction query is scoped by the user's portfolio, and another portfolio's transaction answers as non-existent on `GET`, `PATCH` and `DELETE`. The classification's "Fix authorization before any reuse" line is satisfied | `backend/src/infra/database/TransactionRepository.ts` |
| `assets.symbol` is globally `@unique`: `PETR4` exists in one portfolio only | The symbol belongs to the instrument catalog, unique per symbol; each portfolio has at most one asset per instrument, and several portfolios may hold the same one | [`domain-model.md`](domain-model.md) |
| `transactions.assetSymbol` links transaction and asset, and the rename updates that key | The transaction stores `portfolioId` and `instrumentId`. The rename links the asset to the new symbol's instrument and takes the transactions along, in the same serializable transaction | `backend/src/infra/database/AssetRepository.ts` |
| `POST /v1/asset` and the `newSymbol` of `PATCH /v1/asset/:symbol` accept any valid symbol | The symbol must be in the catalog, or among the caller's private instruments; outside both, `404 Instrument not found in catalog` | `backend/src/services/asset/CreateAssetService.ts`, `backend/src/services/asset/UpdateAssetService.ts` |
| There is no instrument catalog | `GET /v1/instruments` (query `page?`, `limit?` and `search?`; `200` `{ pagination, instruments }`, ordered by symbol) for any authenticated user, and `search` filters by the symbol's prefix or a stretch of the name, case-insensitively, accepting only letters, digits, space and `. & ' -`, so that `%` and `_` do not become an `ILIKE` wildcard, and any other character answers `400`; `POST /v1/instrument` (`201` `{ instrument, message }`) for an admin only, `403` to the rest; `market` accepts only `B3`, `NYSE`, `NASDAQ` and `CRYPTO`, and any other value answers `400` | `backend/src/routes/InstrumentRoutes.ts` |
| There is no instrument registration outside the administered catalog | `POST /v1/asset` accepts an optional `listing` in the body (`market`, `currency`) and, with it, registers as the caller's private instrument what the quote provider lists under the `symbol` in that market and currency — name, class and sector come from the provider, never from the body — and creates the asset over it, in the same write; without `listing`, the symbol must resolve to an instrument already visible to the caller (the catalog or their own private instrument). A symbol already in the catalog answers `409 ALREADY_EXISTS`; a symbol already private to the caller, `409 PRIVATE_ALREADY_EXISTS`; a currency outside the currency of the market given, `422 CURRENCY_MISMATCH` — all three without querying the provider. A symbol the provider does not list in that market and currency answers `404 NOT_LISTED`, and an unavailable provider, `503 UNAVAILABLE`, with nothing written. `PATCH /v1/asset/:symbol` takes no `listing`: `newSymbol` only resolves to an instrument that already existed, in the catalog or private to the caller. Another user's private instrument is always invisible, as if it did not exist (`404`). See `domain-model.md`, §Identity and §Who writes | `backend/src/services/asset/CreateAssetService.ts`, `backend/src/validation/schema/asset/CreateAssetSchema.ts` |
| `PATCH /v1/instrument/:symbol` required an admin for any symbol; there was no scope field and no options endpoint | `GET /v1/instruments` carries `scope` on each item, `CATALOG` or `PRIVATE`; the caller's listing is the whole catalog minus the symbols one of their private instruments shadows, plus their own private ones — never another user's private one. `PATCH` still requires an admin for a `CATALOG` symbol, but a `PRIVATE` symbol is edited by its owner alone, admins included; any other caller gets `403`. `GET /v1/instruments/options`, which fed manual registration, went out with it. The web searches through the `GET /api/v1/instruments/search` proxy (the row below); there is no proxy for `GET /v1/instruments`, `POST /v1/instrument` or the `PATCH`, which stay out of the interface (TD-068) | `backend/src/domain/InstrumentCatalog.ts`, `backend/src/services/instrument/UpdateInstrumentService.ts` |
| Adding an asset outside the catalog required typing name, class, market, currency and sector | `GET /v1/instruments/search` (query `query`, with `search`'s pattern and limit; `200` `{ instruments, listings, marketSearch }`) returns up to 20 instruments visible to the caller under the term and, when the term may be a new symbol (up to 6 letters or digits) and does not name an instrument they already see, what the quote provider lists under it, as `{ symbol, name, type, market, currency }`. `marketSearch` says whether the provider was consulted (`SEARCHED`), skipped (`SKIPPED`) or unavailable (`UNAVAILABLE`); unavailable does not fail the search. Limited to 30 per minute per user (`429`), on top of the general budget, because each term may spend the provider's quota. A term that is missing, empty, repeated or outside the pattern answers `400` | `backend/src/services/instrument/SearchInstrumentsService.ts`, `backend/src/routes/InstrumentRoutes.ts` |
| One portfolio per user (`Portfolio.userId @unique`); `GET /v1/portfolio` returns the caller's and `GET /v1/portfolios` lists them all, unpaginated, for admins only | Each user has N portfolios, with a `name` and a `baseCurrency`. `GET /v1/portfolios` (query `page?`, `limit?`; `200` `{ pagination, portfolios }`, in creation order) lists the caller's only; `GET /v1/portfolio` (query `portfolioId`; `200` `Omit<Portfolio,'assets'>`) returns one of them; `POST /v1/portfolio` (`{ name, baseCurrency }`; `201` `{ portfolio, message }`) creates another; `PATCH /v1/portfolio` (`{ portfolioId, name?, baseCurrency? }`, at least one attribute; `200` `{ portfolio, message }`) renames it or changes the base currency, which only changes while the portfolio has no transaction (`422`); in both, the name is stored in NFC with collapsed spaces, and a name the caller already uses, in any case or spacing, answers `409 You already have a portfolio with this name`, with `details` on `name` (`domain-model.md`, §Portfolio); `DELETE /v1/portfolio` (query `portfolioId`; `200` `{ message }`) deletes the portfolio with its positions and transactions, except the account's last one (`422`). Another user's portfolio answers `404 Portfolio not found for this user`, as non-existent | `backend/src/routes/PortfolioRoutes.ts` |
| Asset and transaction routes resolve the portfolio from the authenticated user | They require `portfolioId`, in the query on `GET` and `DELETE` and in the body on `POST` and `PATCH`; missing or outside the UUID format, `400`; another user's portfolio or a non-existent one, `404`. The transaction-by-id routes take no portfolio and resolve the transaction by the owner of the portfolio it was stored in | `backend/src/validation/schema/PortfolioScopeSchema.ts` |
| `POST /v1/user/create` creates the user's `Portfolio` in the same flow (1:1) | The body requires `baseCurrency` (ISO 4217) and accepts an optional `portfolioName`, with the portfolio name's limits; the first portfolio takes that name, or `Main` without it, in that currency, stored in the same write as the user | [`authentication.md`](authentication.md) |
| No proxy for `/v1/portfolio` and `/v1/portfolios` | `GET /api/v1/portfolios` forwards the query to the backend, `POST /api/v1/portfolios/create` forwards to `POST /v1/portfolio`, `GET`, `PATCH` and `DELETE` `/api/v1/portfolio` forward to `/v1/portfolio` with the `portfolioId` in the query or in the body, and the asset and transaction proxies forward the query string with the `portfolioId`. The web operates the active portfolio, chosen on the portfolios screen, and posts a transaction to `/api/v1/transactions/create`; it used to use `/api/v1/transactions`, which has no handler | `web/src/app/api/v1/portfolio/route.ts` |
| `Asset` with `amount` and `balance`, moved by `increment`/`decrement` on every transaction write | The position (table `positions`) has `quantity`, `averageCost` and `investedValue`, and asset responses carry the three in place of `amount` and `balance`. Creating, editing and deleting a transaction rebuild the position from its transactions; `investedValue` is the cost of the units held, `quantity × averageCost`. Market value does not enter those responses: it comes from `GET /v1/portfolio/positions` | [`domain-model.md`](domain-model.md) |
| `POST /v1/transaction` takes `{ type, amount>0, price>0, assetSymbol }` as `number`s | It takes `{ type, quantity, unitPrice, fees?, taxes?, currency, executedAt, broker?, notes?, assetSymbol, portfolioId }`. `quantity` and `unitPrice` are positive decimal strings, and `fees` and `taxes` decimal strings defaulting to `'0'`, all with up to 20 integer digits and 18 places, with no exponent and no leading zero; `currency` is ISO 4217; `executedAt` is ISO 8601 with a zone; `broker` is up to 60 characters and `notes` up to 500, defaulting to `null`. Transaction responses carry those fields, `portfolioId` and `instrumentId`, with the decimals as strings | `backend/src/validation/schema/transaction/TransactionEntrySchema.ts` |
| `PATCH /v1/transaction/:id` takes `{ type, amount, price }` | It takes the `POST` body without `assetSymbol` and `portfolioId` and replaces every field: an omitted optional goes back to its default | `backend/src/validation/schema/transaction/UpdateTransactionSchema.ts` |
| There are no types beyond `BUY`/`SELL`, and `executedAt` does not exist | The database holds the domain model's 12 types, and the API accepts `BUY`, `SELL`, the income types `DIVIDEND`, `JCP` and `INTEREST`, and `BONUS`, refusing the others until the rebuild implements them (TD-017). The ledger follows `executedAt` and then recording order, and a backdated transaction enters the ledger by its own date | [`domain-model.md`](domain-model.md) |
| Transaction and position quantities and values in `Float` | `DECIMAL(38,18)`; asset responses carry `quantity`, `averageCost` and `investedValue` as strings. A value the column would round gets 400; a write whose ledger passes through a position outside the column, `quantity × averageCost` included, gets 400 `POSITION_OUT_OF_RANGE`, and a transaction in a currency different from the position's others gets 400 `CURRENCY_MISMATCH`, without storing | [`domain-model.md`](domain-model.md) |
| The assets screen computes the average cost from the listed transactions, adding up purchases and sales | It shows the `averageCost` from `GET /v1/portfolio/positions`, in the base currency, without recomputing; the transaction form sends quantity, unit price, fees and taxes as strings, `executedAt`, broker and notes, with the portfolio's `baseCurrency` as `currency` on creation and the transaction's currency on edit | `web/src/components/transaction-form-dialog.tsx` |
| The `/api/v1/assets` proxy sums `totalBalance` and computes `dominance` over `balance` | The proxy was removed, and no web route computes a financial value. The assets screen's positions table shows the allocation and the other values from `GET /v1/portfolio/positions`, in the base currency, with no total in the footer | `web/src/app/(protected)/assets/_components/positions-table.tsx` |
| No quote or market-value route | `GET /v1/assets/valuations` (query `portfolioId` and `symbols`, comma-separated, up to 100, repeats valued once; `200` `{ valuations }`) valued the assets the portfolio holds among the symbols and omitted the rest. Each item carried `symbol` and `outcome`: `valued`, with `quote` (`price`, `currency`, `timestamp`, `source` and, when the provider has it, `previousClose`), `marketValue` and, when comparable, `profitLoss` and `profitLossPercent`; or `not-found` and `unavailable`, without changing the `200`. An invalid query answered `400`, and another user's portfolio `404`. The route and the `/api/v1/assets/valuations` proxy were removed: the positions table reads `GET /v1/portfolio/positions`, which already values what the portfolio holds (TD-034) | [`domain-model.md`](domain-model.md) |
| No consolidated portfolio indicator | `GET /v1/portfolio/overview` (query `portfolioId`; `200` `{ baseCurrency, heldPositionCount, totalValue, investedValue, profitLoss, profitLossPercent, dayChange, dayChangePercent, quotedAt }`) consolidates the positions in the portfolio's base currency, converted at the quote provider's exchange rate. `quotedAt` is the ISO 8601 instant of the oldest quote or rate used in `totalValue` and travels with that total. An indicator that depends on a missing quote, rate or previous close, and a percentage with a zero base, stay out of the body, without changing the `200`. An invalid query answers `400`, and another user's portfolio `404`. The web reads it through the `GET /api/v1/portfolio/overview` proxy, with the `usePortfolioOverview` hook | [`domain-model.md`](domain-model.md) |
| No position listing with market value | `GET /v1/portfolio/positions` (query `portfolioId`, `page` and `pageSize` and, optionally, `sortBy`, `sortOrder`, `search`, `type` and `status`; `200` `{ items, page, pageSize, total, totalPages }`) lists the portfolio's positions. `sortBy` is `symbol` (default), `quantity`, `averageCost`, `marketPrice`, `marketValue`, `allocation`, `profitLoss` or `profitLossPercent`, and `sortOrder` is `asc` (default) or `desc`; by a value, the position missing it goes last in both directions, and ties follow `symbol` order. `search`, up to 120 characters, searches `symbol` and `name` without distinguishing case; `type` is the instrument's class, and `status` is `open`, with units, or `closed`, without units. `total` counts only the positions that meet the filters. Each item carries `symbol`, `name`, `quantity`, `baseCurrency` and, when computable, `averageCost`, `marketPrice`, `marketValue`, `allocation`, `profitLoss` and `profitLossPercent`, in the base currency. A field that depends on a missing quote or rate stays out of the item, without changing the `200`. An invalid query answers `400`, and another user's portfolio `404`. The web reads it through the `GET /api/v1/portfolio/positions` proxy, with the `usePositions` hook | [`domain-model.md`](domain-model.md) |
| `GET /v1/asset/:symbol` returns the asset, with no quote and no market value | `GET /v1/portfolio/positions/:symbol` (query `portfolioId`; `200` with the position) describes one of the portfolio's positions, with or without units: the fields of a `GET /v1/portfolio/positions` item, with the allocation over the whole portfolio, `type`, `market`, `currency` and `sector` from the catalog, and `quote`, the current quote in the currency it was quoted in, with `price`, `currency`, `timestamp` and, when computable, `previousClose`, `dayChange` and `dayChangePercent`. The symbol is normalized as on a write. A field that depends on a missing quote or rate stays out of the body, without changing the `200`. A symbol with no position in the portfolio answers `404 Asset not found in portfolio`, without consulting the provider; an invalid query or symbol, `400`; another user's portfolio, `404`. The web reads it through the `GET /api/v1/portfolio/positions/[symbol]` proxy, with the `usePosition` hook, and `GET /v1/asset/:symbol` was removed (TD-034) | [`domain-model.md`](domain-model.md) |
| No portfolio distribution | `GET /v1/portfolio/allocation` (query `portfolioId`; `200` `{ baseCurrency, totalValue, byAsset, byType, bySector, byCurrency }`) distributes the portfolio's positions with units, in the base currency, by asset (`symbol` and `name`), `type`, `sector` and the quote's currency. Each group carries `marketValue` and `allocation`, the sum of its positions' values in `GET /v1/portfolio/positions`. A field that depends on a missing quote or rate stays out of the group, and `totalValue` out of the body, without changing the `200`. An invalid query answers `400`, and another user's portfolio `404`. The web reads it through the `GET /api/v1/portfolio/allocation` proxy, with the `useAllocation` hook | [`domain-model.md`](domain-model.md) |
| `GET /v1/transactions/:assetSymbol` sorts by `id`, a random UUID, paginates by `lastId` and ignores `page` (TD-002) | `GET /v1/transactions` (query `portfolioId` and, optionally, `symbol`, `type`, `broker`, `dateFrom`, `dateTo`, `page` and `pageSize`; `200` `{ items, page, pageSize, total, totalPages }`) lists the portfolio's transactions from the most recent to the oldest, by `executedAt` and then by recording order. Each item carries the transaction's fields and the instrument's `symbol`. `symbol` and `type` are normalized as on a write, `broker` is compared against the stored value, and `dateFrom` and `dateTo` are ISO 8601 instants with a zone, inclusive, over `executedAt`; a filter with no match answers an empty `items`. An invalid query answers `400`, and another user's portfolio `404`. The listing by symbol and the `/api/v1/transactions/[symbol]` proxy were removed. The web reads the listing through the `GET /api/v1/transactions` proxy, with the `useTransactions` hook | `backend/src/infra/database/TransactionRepository.ts` |
| `GET /v1/transactions/:assetSymbol/count` counts an asset's purchases and sales, and the assets screen's table asks for one count per row | The count became a field of the asset listing's item, and then the whole listing went out: `GET /v1/assets`, the count endpoint and the `/api/v1/assets` and `/api/v1/transactions/[symbol]/count` proxies were removed. The assets screen reads `GET /v1/portfolio/positions` (TD-034) | `backend/src/routes/AssetRoutes.ts` |
| No route returns the caller's profile; the web keeps the sign-in user in `localStorage`, and the assets table labels the values with a currency chosen in a selector, without conversion | `GET /v1/user` (authenticated; `200` `{ user: { id, name, email, createdAt, updatedAt } }`) returns the caller's profile, with no credential columns and no `isAdmin`. The `GET /api/v1/user` proxy forwards it with the session cookie, and the protected area reads the profile through React Query, with no `localStorage`. The currency selector went out: the positions table formats the values in the `baseCurrency` the response reports | [`authentication.md`](authentication.md) |
| No indicator of a position beyond its value and unrealized result | `GET /v1/portfolio/positions/:symbol/indicators` (query `portfolioId`; `200` `{ prices?, returns? }`) describes one of the portfolio's positions, with or without units. `prices`, from the last year's daily closes in the quote's currency, carries `currency`, `close`, `closedOn`, `yearLow`, `yearHigh`, `changes` — the change over `1M`, `3M`, `6M`, `YTD` and `1Y`, each without a `change` when the history does not reach it and, with a `change`, the opening day in `openedOn` — and `closes`, one close per day (`close`, `closedOn`) in ascending order, from `1Y`'s opening, or from the first close when the history is shorter, to the most recent one; it stays out of the body with no close in the last year. `returns`, from the ledger executed up to the request's instant in its currency, carries `currency`, `since`, `realizedProfitLoss`, `income`, `trailingIncome` and, with an invested value, `yieldOnCost`; it stays out of the body with no transaction. Missing closes are requested from the provider and stored, as in performance, and an unavailable provider leaves `prices` with what is stored. The symbol is normalized as on a write. A symbol with no position in the portfolio answers `404 Asset not found in portfolio`, without reading history; an invalid query or symbol, `400`; another user's portfolio, `404`. The web reads it through the `GET /api/v1/portfolio/positions/[symbol]/indicators` proxy, with the `usePositionIndicators` hook | [`financial-rules.md`](financial-rules.md) |
| No fundamental indicator | `GET /v1/portfolio/positions/:symbol/fundamentals` (query `portfolioId`; `200` `{ outcome, source?, figures? }`) describes a position's instrument by the indicators its class supports. `outcome` is `reported`, with `source`, the source that computed them, and `figures`, one `{ metric, value? }` per indicator of the class, in display order, without `value` when the source does not report it, and `freeCashFlow` with `currency`; `not-applicable`, for a class with no indicator, without consulting the provider; `not-found`; or `unavailable`, without changing the `200`. The symbol is normalized as on a write. A symbol with no position in the portfolio answers `404 Asset not found in portfolio`, without consulting the provider; an invalid query or symbol, `400`; another user's portfolio, `404`. The web reads it through the `GET /api/v1/portfolio/positions/[symbol]/fundamentals` proxy, with the `usePositionFundamentals` hook | [`financial-rules.md`](financial-rules.md) |
| No historical portfolio series | `GET /v1/portfolio/performance` (query `portfolioId`, `range?` — `1W`, `1M`, `3M`, `6M`, `1Y` (default), `YTD` or `MAX` —, `benchmark?`, a catalog symbol, and `symbol?`; `200` `{ baseCurrency, from, to, series, benchmark? }`) returns the portfolio's value at the close of each traded day in the window, in the base currency. Each point carries `date`, `value`, `investedValue`, `netContribution` and `twr`, the time-weighted return accumulated since the first point, which counts neither the day's contribution nor its withdrawal as a gain. A day missing the close or the exchange rate of some held position stays out of the series, without changing the `200`. The window ends at the start of the current day in UTC, exclusive, and `MAX` starts on the day of the ledger's first transaction. With `benchmark`, the body carries `{ symbol, currency, series }`, each point with `close` and the return over the window's first close; a symbol outside the catalog answers `404 Instrument not found in catalog`. With `symbol`, the series is that of the position for that symbol, rebuilt from its transactions alone, and a symbol with no position in the portfolio answers `404 Asset not found in portfolio`. An invalid query answers `400`, and another user's portfolio `404`. The web reads it through the `GET /api/v1/portfolio/performance` proxy, with the `usePerformance` hook, asks for `symbol` on the asset detail and does not ask for `benchmark` | `backend/src/domain/PortfolioPerformance.ts` |
| User `PATCH`/`DELETE` with no proxy route; the account screen showed the profile without being able to change it | `PATCH /api/v1/user` (cookie) forwards to `PATCH /v1/user`. When the body carries `newPassword` and the API answers `2xx`, the proxy clears the `ex3:token` cookie in that same response, because the change revoked the session; the account screen edits the name and changes the password through it. `DELETE /v1/user` still has no proxy | `web/src/app/api/v1/user/route.ts` |
| Transaction `PATCH` and `DELETE` with no proxy route; the web neither edits nor deletes a transaction | `PATCH` and `DELETE` `/api/v1/transactions/[id]` (cookie) forward to `/v1/transaction/:id`, with the id encoded in the URL, and the backend validates the UUID and ownership. The web edits and deletes through the transaction detail dialog, on the asset detail and on the Overview, with confirmation before deleting, and no mutation retries the failed request on its own | `web/src/app/api/v1/transactions/[id]/route.ts` |
| No route reports whether the instance is up or fit to serve | `GET /health` (unauthenticated, outside `/v1`; `200` `{ status: 'alive' }`) answers without touching any dependency, and `GET /ready` (likewise; `200` `{ status: 'ready', database: 'up' }`) queries the database on every call and answers `503 INFRASTRUCTURE` when it does not answer, without telling the caller what failed. Both sit behind the API's rate limit. The `backend` service's `healthcheck` in `compose.yaml` calls `/ready`; in production, nothing probes them yet (TD-060) | [`observability.md`](observability.md) |
