# Architecture

Who owns what, which way the dependencies point, and what does not belong in
each layer. What the entities mean is in [`domain-model.md`](domain-model.md);
the contract of each route is in [`api-inventory.md`](api-inventory.md).

## Map

```text
                    ┌─────────────────────────────────────────────┐
browser ───────────▶│ Frontend            web/src/app, components,│
                    │                     hooks, providers        │
                    ├─────────────────────────────────────────────┤
                    │ Next proxy          web/src/app/api/v1      │──┐
                    └─────────────────────────────────────────────┘  │ Bearer
                                                                     ▼
                    ┌─────────────────────────────────────────────┐
                    │ API        routes ▸ middleware ▸ controllers│
                    │            ▸ services                       │
                    ├──────────────────────┬──────────────────────┤
                    │ Domain               │ ports: MarketData-   │
                    │ pure computation     │ Provider             │
                    ├──────────────────────┼──────────────────────┤
                    │ Persistence          │ Market Data          │
                    │ infra/database       │ infra/market-data    │
                    └──────────┬───────────┴───────────┬──────────┘
                               ▼                       ▼
                          PostgreSQL              YH Finance

Authentication cuts across the layers: cookie and redirect in the web, Bearer
in the proxy, verification in the API middleware, hashing and signing in infra.
```

| Layer | Code | May import | Never imports |
| --- | --- | --- | --- |
| Frontend | `web/src/app`, `components`, `hooks`, `providers`, `lib` | its own proxy, over HTTP | backend, database driver |
| API | `backend/src/routes`, `middleware`, `controllers`, `validation`, `services` | Domain, Persistence, Market Data | — |
| Domain | `backend/src/domain` | itself only | `@/infra`, `express` |
| Persistence | `backend/src/infra/database` | Domain | `express`, `@/services` |
| Market Data | `backend/src/infra/market-data` | Domain (the port it implements) | `express`, `@/services` |
| Authentication | `web/src/proxy.ts`, `web/src/lib`, `backend/src/middleware/AuthMiddleware.ts`, `backend/src/infra/cryptography` | the layer it lives in | — |

The last three columns are checkable by search, and the corresponding searches
return nothing today:

```sh
cd backend/src
grep -rl "from '@/infra" domain           # the domain does not reach infrastructure
grep -rl "from 'express'" domain services # neither domain nor service knows HTTP
grep -rl '@prisma/client' controllers     # no controller talks to the database
```

The only dependency on `@prisma/client` outside `infra/database` is
`Prisma.Decimal`, the numeric type the domain uses so that money is never
computed in floating point — a value, not database access.

## Frontend

**Responsibility:** render the state the API delivers and capture user intent.
It computes no domain number: average cost, market value, allocation and return
arrive ready, in the base currency the response states.

`web/src/app` is the App Router, in two groups: `(public)` with sign-in and
sign-up, `(protected)` with overview, assets and account. `web/src/proxy.ts`
runs ahead of every page request, decides the session and emits the CSP with a
nonce. `components/ui` are primitives over Radix and Tailwind; `components` are
the product's composites. `providers/app-provider.tsx` wires the `QueryClient`,
the error boundary with `Suspense`, and the `Toaster`.

**Reading rule:** every browser request originates in a hook from
`web/src/hooks` over TanStack Query — no screen calls `fetch` on its own, and
every request that exists is inventoried in
[`data-fetching.md`](data-fetching.md). Accessibility, layout and frontend
performance criteria are in [`accessibility.md`](accessibility.md),
[`responsiveness.md`](responsiveness.md) and
[`performance.md`](performance.md).

**Proxy.** The Route Handlers under `web/src/app/api/v1` are the boundary: they
read the `httpOnly` `ex3:token` cookie, send `Authorization: Bearer` to the
backend and return the API's body. The browser never receives the token or the
backend URL — `API_URL` exists only on the Next server. A handler that merely
forwards delegates all of this to `forwardToApi`, in
`web/src/lib/api-proxy.ts`: it declares verb, path, query string and whether
there is a body to pass along. `sign-in`, `sign-up`, `sign-out` and
`session/expire` keep their own handler because they write or clear cookies.

## API

**Responsibility:** translate HTTP into a use case and a use case into HTTP. It
is the only layer that knows `Request` and `Response`.

| Module | Does | Does not |
| --- | --- | --- |
| `routes` | declares path, method and the middleware chain | logic |
| `middleware` | correlation and logging, helmet, CORS, body limit, rate limit, authentication, 404 and the error boundary | business rules |
| `controllers` | validates input with zod and calls a service | reach a repository or provider |
| `services` | orchestrates the use case: ownership, repositories, provider, database transaction | know HTTP |
| `validation` | zod schemas and the `validate` that turns a `ZodError` into a `ValidationError` | — |
| `errors` | the classes that name each failure category | respond |

Middleware order in `config/App.ts` is meaningful: logging comes first, so that
every request carries an id, including one that dies in CORS or in the rate
limiter; the error boundary comes last. The `{ code, message, details }`
envelope and the eight categories are in [`errors.md`](errors.md); the shape of
a log line is in [`observability.md`](observability.md).

Portfolio ownership is checked in a single place, `requireOwnedPortfolio` in
`services/PortfolioAccess.ts`: another user's portfolio answers as
non-existent, and no service repeats the query. The four use cases that value
positions start from `readPortfolioHoldings` and `quoteHoldings`, in
`services/portfolio/QuotedHoldings.ts`, which read the portfolio's positions
and quote, in a single batch, the ones each of them values.

Controllers and services are singletons with `getInstance`, composed by hand in
the `index.ts` of each controller folder. The handler a route registers builds
the graph for that use case and delegates; because every piece is a singleton,
building is cheap and the dependency tree stays explicit in one file per
subject.

## Domain

**Responsibility:** the rules that define the product, as pure functions over
values. No I/O, no Prisma beyond the decimal type, no `Request`.

| Module | Rule it owns |
| --- | --- |
| `PositionLedger` | rebuilds the position from the ordered ledger and refuses an impossible ledger |
| `PositionValuation` | cost, market value and result of one position |
| `PortfolioValuation` | portfolio positions in the base currency, filtering, sorting and allocation |
| `PortfolioPerformance` | daily series of value, net contribution and time-weighted return |
| `PriceHistory` | the window of days still missing and the cut by closing price |
| `models` | the domain types, independent of database rows |
| `MarketDataProvider` | the **port** prices come in through, defined here and implemented outside |

It is the most tested layer and the cheapest to test: the unit tests exercise
these modules with no database, no network and no real clock.

## Persistence

**Responsibility:** store and retrieve state, and be the only place in the code
that speaks SQL or Prisma.

`PrismaClient` is the singleton that loads the `@prisma/adapter-pg` adapter and
exposes `runSerializable`, which runs an operation in a serializable
transaction and retries it up to three times when Postgres aborts it on a write
conflict. Each repository covers one aggregate (`User`, `Portfolio`, `Asset`,
`Transaction`, `Instrument`, `MarketQuote`, `ExchangeRate`) and converts a row
into a domain model — a decimal becomes a string, never a `number`. When an
operation spans more than one table it runs in a serializable transaction:
opened by the repository itself, as in `UserRepository.delete`, or received as
a `TransactionClient` from the larger operation, as in `TransactionRepository`.

The schema and the migrations live in `backend/prisma`. No domain write happens
outside a transaction when it touches more than one table: recording a
transaction, deleting an asset and deleting an account are atomic.

## Market Data

**Responsibility:** obtain prices and exchange rates from outside without that
leaking into the domain.

`YahooFinanceProvider` implements the `MarketDataProvider` port: it translates a
catalog symbol into the provider's symbol, sends the key only in the header of
the provider's own origin, refuses redirects and validates everything it
receives with zod — a provider response is untrusted input. It caches a quote
for 60s, joins a symbol already in flight — and, for history, a window already
in flight — into the same request, caches an empty history window for one hour
and, after a failure, answers for 30s with the last observed quote instead of
insisting, recording `quote_provider_unavailable`. It also resolves a ticker
across the listings the provider carries — name, class, market and currency,
from the same quote request, cached for one hour — and the sector, from the
asset profile, so that registering an instrument does not ask the user for
those attributes.

A provider failure never becomes a 500: the port answers `not-found`,
`unavailable` or `range-not-served`, and the service omits from the body the
field that depended on that price, keeping the 200. Daily closes are persisted
(`MarketQuoteRepository`, `ExchangeRateRepository`) and only the missing days
are requested.

## Authentication

**Responsibility:** prove who the caller is on every request, and revoke the
session when the user says so.

| Point | What it decides |
| --- | --- |
| `web/src/proxy.ts` | a protected route without a valid token redirects to sign-in, carrying the requested path in `next` and, when a token or a session marker exists, `reason=session-expired`; an expired token is cleared |
| `web/src/lib/session.ts` | writes the `httpOnly` cookie with the token's own expiry |
| `web/src/app/api/v1/**` | attaches `Authorization: Bearer`; with no cookie, answers 401 without calling the backend |
| `backend/src/middleware/AuthMiddleware.ts` | verifies the signature and compares the `sessionVersion` claim against the user's row |
| `backend/src/infra/cryptography` | `Jwt` signs and verifies; `Bcrypt` derives and checks the password |

The session is stateful on purpose: sign-in, sign-out and a password change
increment `sessionVersion` and invalidate every token issued earlier. The
decisions, and what has already been fixed, are in
[`authentication.md`](authentication.md).

## How a request crosses the system

`GET /v1/portfolio/positions`, from click to body:

1. The `usePositions` hook asks Next itself for `/api/v1/portfolio/positions`.
2. The Route Handler reads the cookie, builds `Authorization: Bearer` and calls
   the backend.
3. `requestLogMiddleware` assigns the request id and installs the `finish`
   listener; helmet, CORS, body limit and rate limit run next.
4. `portfolioRouter` matches the path and runs `authMiddleware`, which resolves
   `req.user`.
5. The route's handler composes repositories, service and controller, and
   delegates.
6. The controller validates the query with zod and calls `execute` with the
   authenticated `userId` — never with an id taken from the body.
7. The service confirms portfolio ownership, reads assets and ledger, asks the
   port for quotes and exchange rates, and hands the values to the domain
   functions.
8. The controller answers `200` with the page; a typed error at any point rises
   to the error boundary and becomes an envelope.
9. When the response finishes, one log line goes out with id, route, status,
   duration and the error code, if there was one.

## Known limits

* Routes register their handlers with `as Application` in 29 places: the
  controllers return `Promise<Response>`, and the Express 5 signature expects
  `void`. `HealthRoutes.ts` shows the way without the cast — respond and return
  `void`.
* Per-use-case composition is written by hand in the controllers' `index.ts`.
  It is explicit and needs no injection container, at the cost of repetition
  when a service gains a dependency.
* The frontend has no test runner; its gates are `lint`, `typecheck` and
  `build` (TD-058 in [`../TODO.md`](../TODO.md)).
