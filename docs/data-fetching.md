# Data fetching

Every browser request originates in a hook from `web/src/hooks` over TanStack
Query, crosses the Next proxy in `web/src/app/api/v1` and reaches the backend.
This document inventories each one, says what triggers it and justifies,
request by request, why it exists. Reading rule: **no screen fires a request
that is not in this table.**

| Item | Value |
| --- | --- |
| Audit commit | `6e955aa` |
| Date | 2026-09-19 |
| Scope | `web/src/hooks`, `web/src/lib/react-query.ts`, `web/src/lib/axios`, consumers in `web/src/app/(protected)` |

## Client defaults

In `web/src/lib/react-query.ts`, applying to every query:

| Option | Value | Reason |
| --- | --- | --- |
| `staleTime` | 60 s | `YahooFinanceProvider` serves the same quote for `QUOTE_TIME_TO_LIVE_MS` (60 s). Repeating the request inside that window returns the same numbers and burns plan quota for nothing. Writes do not depend on it: every mutation invalidates the portfolio scope |
| `refetchOnWindowFocus` | `false` | Switching tabs is no sign that the market moved; the 60 s window already covers coming back |
| `refetchOnReconnect` | default (`true`) | Reconnecting is a sign that the client was offline for an indeterminate time; `staleTime` still filters what is fresh |
| `retry` | up to 2, except for a rejected request | A 4xx is a rejection of the request itself: repeating it gives the same result, delays the error state and, for a 401, races the interceptor's expiry |
| `gcTime` | default (5 min) | Navigating across the three screens and back does not redo what is still cached |

For `retry` to tell 4xx from 5xx, the interceptor in
`web/src/lib/axios/axios.ts` now copies `status` and `statusText` from the
response onto `ApiProxyError`; before that the `{ message, _error }` body
arrived without a status and every error became a 500 on the client.

## Query inventory

| Hook | Endpoint | Key | Trigger | Rationale |
| --- | --- | --- | --- | --- |
| `useActivePortfolio` | `GET /v1/portfolio?portfolioId=` with a chosen portfolio; otherwise `GET /v1/portfolios?page=1&limit=1` | `['portfolios', 'details', id]` or `['portfolios', 'page', {page,limit}]` | Every protected screen | The chosen portfolio id comes from `localStorage` (`useSyncExternalStore`, with `undefined` on the server so nothing is requested before the read); with no choice, the oldest one. A single cache entry serves every screen |
| `usePortfolios` | `GET /v1/portfolios` | `['portfolios', 'page', {page,limit}]` | `/portfolios` | The paginated list on the portfolios screen |
| `useInstrumentSearch` | `GET /v1/instruments/search` | `['instruments', 'search', query]` | `AddAssetDialog`, once the user types | An empty field requests nothing (`skipToken`). A 500 ms debounce, which Enter short-circuits: the pause is that of someone who stopped typing, so one term costs about one of the 30 searches per minute the API grants; each term is a key, and the previous result stays visible while the next loads |
| `useCurrentUser` | `GET /v1/user` | `['user']` | `sidebar.tsx` and `/account` | Name and email for the navigation header; both consumers share the same key, so it is one request, not two. Saving the profile writes the `PATCH` response into the key, with no new `GET` |
| `usePortfolioOverview` | `GET /v1/portfolio/overview` | `[...portfolio, 'overview']` | `PortfolioValueCard`, `PortfolioTotalValue` | Aggregate totals the positions listing does not carry. On the portfolios screen, one query per row, under the same key as the Overview: an asset or transaction write invalidates the portfolio scope and updates both |
| `useAllocation` | `GET /v1/portfolio/allocation` | `[...portfolio, 'allocation']` | `AllocationChart` | Grouping by asset and by class, with percentages computed on the server; the web sorts by percentage |
| `usePositions` | `GET /v1/portfolio/positions` | `[...portfolio, 'positions', listing]` | The Overview summary and the `/assets` table | Two distinct cuts — 10 unfiltered rows against the filtered, sorted and paginated listing — hence two keys and two requests |
| `usePosition` | `GET /v1/portfolio/positions/:symbol` | `[...portfolio, 'position', symbol]` | Asset detail | One position with the breakdown the listing does not carry |
| `usePerformance` | `GET /v1/portfolio/performance` | `[...portfolio, 'performance', params]` | The Overview and detail charts | A time series per period; switching period is another key, fetched once and served from cache on later switches |
| `useTransactions` | `GET /v1/transactions` | `[...portfolio, 'transactions', filters]` | Overview (last 5) and asset detail (paginated by symbol) | Distinct cuts of the same listing; neither derives from the other |

Every portfolio-scoped query uses `skipToken` until the portfolio has arrived:
none of them fires with an undefined `portfolioId`.

`usePositions`, `usePerformance` and `useTransactions` keep the previous page
visible while the requested one loads: paginating, sorting or switching period
remains **one** request per parameter change, not two. The placeholder applies
within the same portfolio only (`partialMatchKey` against
`['portfolio', id]`), so switching the active portfolio shows the loading
state, never the previous one's numbers.

Creating, editing or deleting a portfolio invalidates `['portfolios']`; editing
also invalidates the portfolio scope, because the base currency changes the
values, and deleting removes the scope from the cache and discards the choice
that pointed at it.

Creating an asset with `listing` — registering a private instrument from the
provider's listing — invalidates `['instruments']`
(`queryKeys.visibleInstruments()`), the prefix that covers every
`useInstrumentSearch` search: the registered instrument starts coming back
among the ones the user sees, with the *Private* badge, and no longer as a new
listing. Creating an asset without `listing` invalidates nothing under
`['instruments']`, because no instrument was written.

## Waterfall

There is one level, and only one: `GET /v1/portfolios` must resolve before the
screen's other queries.

```text
/v1/portfolios
└─ in parallel: overview · allocation · performance · positions · transactions
```

On the Overview that is 1 + 5 requests, the five of them simultaneous. The
extra level is inherent to the current contract — the portfolio id does not
exist on the client before the listing — and costs one round trip on the
session's first screen only, because the 60 s of `staleTime` cover later
navigation. Removing it depends on the API delivering the primary portfolio
alongside the session, recorded as TD-055.

No screen chains a second level: the asset detail's `usePosition`,
`usePerformance` and `useTransactions` all start from the same portfolio and
run together.

## What the audit looked for and did not find

| Suspicion | Result |
| --- | --- |
| Duplication | None. Repeated calls of the same hook — `useActivePortfolio` on four screens, `useCurrentUser` on two — share a key and are served by a single request |
| N+1 in the proxy | None. Each Route Handler in `app/api/v1` makes exactly one call to the backend |
| N+1 in the backend | None. `GetPortfolioPositionsService`, `GetPortfolioOverviewService`, `GetPortfolioAllocationService` and `GetPortfolioPositionService` fetch quotes and exchange rates in batch, in one `Promise.all` per request. The per-instrument history of the performance endpoint had one extra read, fixed in the [2026-09-24 audit](#request-and-integration-audit--2026-09-24) |
| Excessive refetching | This was the real finding: with no `staleTime`, every mount redid everything — going back from `/assets` to the Overview cost five requests that would change nothing. Solved by the 60 s default |
| Unnecessary retries | Also a real finding: a 404 for a non-existent asset became three requests. Solved by the `retry` that does not repeat a rejected request |

## Invalidation

`useRefreshPortfolio` invalidates the `['portfolio', portfolioId]` prefix,
which reaches overview, allocation, performance, positions, position and
transactions in one call. It is what runs after creating an asset, creating,
editing and deleting a transaction, and deleting an asset — every write in the
product — without being awaited: the mutation resolves with the API's response,
the dialog that fired it closes, and revalidation catches up, with the cached
data in view until it arrives.

Two deliberate choices:

* **Asset and transaction writes invalidate neither `['portfolios']` nor
  `['user']`**, which none of them changes. Portfolios have their own
  invalidation, described in the inventory. The profile does not revalidate
  `['user']` on success: the `PATCH` response already carries the saved user
  and is written into the key.
* **`queryClient.clear()` when the public layout mounts.** Discarding the whole
  cache on a session change is a security requirement, not a performance one:
  no data from one account may survive into the next. It is done on mount, not
  on sign-out, because removing queries that are still observed refetches them
  without a session.

## Request and integration audit — 2026-09-24

### Optimistic updates

Only where a server refusal is rare and undoing costs the user nothing. Where
the server decides something the interface cannot predict, the screen waits for
the response.

| Write | Optimistic | Reason |
| --- | --- | --- |
| Profile name | Yes | The form validates by the same rule as the API, so refusal is rare, and renaming again undoes it. The name changes in the navigation and in the form on submit; a failure restores the previous name and revalidates `['user']`, because a timeout may have saved the new one; the error appears in the form |
| Password | No | Changing the password ends the session on the server (`sessionVersion`); there is no interface state to anticipate |
| Create, edit and delete a transaction | No | The ledger is validated on the server — a sale above the units held on the date, a single currency per position, a position within the supported range — and every write recomputes position, average cost and performance on the server. Anticipating would show numbers the API may refuse or compute differently |
| Create an asset | No | The server resolves the instrument, and the private one from the provider's listing; the row depends on a quote the client does not have |
| Delete an asset or a portfolio | No | Irreversible and cascading. `ConfirmDeletionDialog` stays open until the response and shows the failure in place (TD-064); the focus that is returned depends on the list having been revalidated |
| Create and edit a portfolio | No | Changing the base currency reprices every value on the server; the dialog shows the refusal in place |

### Loading strategies

| Strategy | Situation |
| --- | --- |
| Skeleton and per-section state | Already in place: each section has its own loading, error and empty state (`QuerySection`) |
| Previous page kept visible | Already in place: paginating, sorting and switching period keep the data in view until the next arrives |
| Code out of the route's bundle | Done: `sideEffects` in `package.json` removed the calendar and the unused UI from the public routes and from the account (see `performance.md`) |
| Dialogs on demand | Not done: the cost would move out of loading and into the first click of the screen's primary action (see `performance.md`) |
| Prefetching the next page | Not done: with the previous page visible, paginating no longer blocks, and every prefetch is a request against the limit of 120 per minute |
| Prefetching the detail on hover | Not done: the detail asks for performance and indicators, which may fetch history from the provider. It would spend plan quota with no click |
| Portfolio → scope waterfall | Kept (TD-055) |

### Refreshing the portfolio value

The button invalidates the portfolio scope with `cancelRefetch: false`: a click
during revalidation joins it instead of restarting it, and the button stays
`aria-disabled` until it finishes. In the backend, a quote is good for 60 s
(`QUOTE_TIME_TO_LIVE_MS`), so repeating the refresh within the minute redoes
the database read but does not call the provider.

### Backend and provider

| Finding | Fix |
| --- | --- |
| The edge of a series with no close was requested from the provider on every read: a weekend or holiday after the last close, days before the listing or before the window's first session, a symbol the provider answers 404 for. `missingRangesOf` asks for those windows again, because nothing is stored for them | The adapter answers empty again, with no request, for a window the provider answered without a price or with a 404, for one hour (`EMPTY_HISTORY_TIME_TO_LIVE_MS`) and up to 10,000 windows. A window with a price, and a failure, are not stored: the first changes what is missing, the second already pauses the provider for 30 s |
| Identical simultaneous history lookups made one request each — the asset detail asks for performance and indicators together, and both still end in the same window | A lookup already in flight for the same symbol, interval and window is reused, as with quotes |
| `GetPriceHistoryService` read the instrument before the stored history, one extra sequential query per instrument on every performance and indicator read | The instrument is read only when something is missing and has to be requested from the provider; an up-to-date series costs one query |

All of it lives in the process's memory, like the quote cache. Each instance
has its own cache, and it is lost on a cold start.

### Indexes

The existing ones cover the reads: closes and exchange rates by
`(instrumentId, timestamp, …)` and `(currency, baseCurrency, timestamp, …)`
over a date range, positions by `(portfolioId, instrumentId)`, transactions by
`(portfolioId, instrumentId)`. The portfolio ledger and the transaction listing
filter by `portfolioId` and sort by `executedAt` after filtering; at the volume
of a personal portfolio, that sort is small. A `(portfolioId, executedAt)`
index starts paying off when the `EXPLAIN` of `GET /v1/transactions` or of the
performance endpoint shows that sort in a measured p95.

### Redis: adoption criteria

Not adopted. Everything a shared cache would solve today is solved in the
process's memory, because the cost it avoids — a provider call, a rate-limit
count — is per instance and has not been measured yet. It starts to pay off
when at least one of these is measured:

* **Rate limiting across instances (TD-006).** With more than one instance
  serving traffic, the effective limit is the budget times the number of
  instances. If that stops being acceptable, the counters need a shared store.
* **Provider quota.** If measured plan consumption (TD-020) shows the same
  quote or history window being requested by several instances, or again after
  every cold start, to the point of threatening the quota.
* **Session revocation without the database.** Today `sessionVersion` is read
  from Postgres on every authenticated request. Only if that read shows up in a
  measured p95.

Before Redis, the order is: tune the TTLs with measured consumption; fix the
number of instances; store in Postgres whatever must survive a restart, such as
the empty windows, in a coverage table.

## Known limit

The measurement was static: reading the code of queries, proxies and services.
There is no waterfall observed in a browser and no request count taken at
runtime, for the same reason recorded in `accessibility.md` — the
implementation environment has neither a browser nor network permission.
Runtime verification belongs to the TD-054 harness.
