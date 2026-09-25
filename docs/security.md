# Security

Checklist from the final audit (TASK 20.4). Each item says where the control
lives, what was verified and what remains an accepted risk. What is specific to
session and password is in [`authentication.md`](authentication.md); the error
envelope is in [`errors.md`](errors.md).

## Input surfaces

| Surface | Validation | Rejection | Trust in the caller |
| --- | --- | --- | --- |
| Body and query of every `/v1` route | zod schema in `backend/src/validation/schema`, applied by `validate()` in the controller, ahead of the service | `400 VALIDATION` with one `{ path, message }` per refused field | none |
| `Authorization` header | `authMiddleware`: `Bearer` scheme, HS256 signature, claims re-parsed, `sessionVersion` checked against the user's row | `401 AUTHENTICATION` | none |
| `x-request-id` | `PROPAGATED_REQUEST_ID` accepts 8–64 characters of `[A-Za-z0-9-]`; anything else and the id is generated | id dropped silently, with no error | none: the value only comes back in the header and in the log |
| `Origin` | `CORS_ALLOWED_ORIGINS` allowlist, required in production | response without `Access-Control-Allow-Origin` | none |
| `x-client-address` and `x-api-proxy-secret` | `clientAddressOf` (`RateLimitMiddleware.ts`): the address counts only with the `API_PROXY_SECRET` secret and only if it is an IP | header ignored silently; the request counts against the address that connected | the web only, which proves itself with the secret |
| `X-Forwarded-For` in the web | `clientAddressHeaders` (`web/src/lib/api-proxy.ts`) uses the last entry only, the one the platform appends | earlier entries ignored | none: whatever the client sends sits before the platform's entry |
| Body of the web's route handlers | `jsonPayload` (`web/src/lib/api-proxy.ts`) | `400 Bad Request` with the `{ message, _error }` envelope | none |
| Quote provider (Yahoo Finance) | fixed origin and a symbol restricted to letters and digits, escaped into the URL; the response is schema-parsed before becoming a price or an instrument attribute, with name and sector length-capped; from the client, registration accepts only symbol, market and currency | infrastructure failure; the position is reported from the ledger | response treated as external data |

The body is capped at `100kb` (`RequestLimits.JSON_BODY_SIZE`) ahead of any
parsing, and a payload above that answers `413`.

## Secrets

* `EnvsSchema` refuses the process at boot: a `JWT_SECRET` under 32 characters,
  a `BCRYPT_SALT` below 10 rounds, a `JWT_EXPIRATION` without a unit or above
  `30d`, `CORS_ALLOWED_ORIGINS` missing in production, an `API_PROXY_SECRET`
  under 32 characters or missing in production. There is no insecure default —
  what is missing brings the boot down, it does not silently degrade.
* No secret is logged. The request line identifies the user by id and nothing
  else; the web's upstream failure log is assembled field by field precisely
  because an `AxiosError` carries the caller's token in its config.
* `.gitignore` ignores `.env*` at the root and in the backend, allowing only
  `.env.example` and the versioned `.env.test`, whose `JWT_SECRET` is good for
  the suite alone and whose database is the local test one.
* Under `NODE_ENV=test`, `config/Envs.ts` and `prisma.config.ts` do not load the
  developer's `.env`: a credential the suite did not declare cannot reach a
  database that is not the test one (TD-059).
* `API_URL` is read by the server at runtime. Until TASK 20.4 `next.config.js`
  exported it through `env`, which **inlines the value into the client
  bundle**: the API address travelled in every visitor's JavaScript. The web's
  `Dockerfile` now declares it in the `runner` stage, and the browser stopped
  receiving it.

## Session cookie

`COOKIE_OPTIONS` (`web/src/common/constants.ts`): `httpOnly`,
`sameSite: 'strict'`, `secure` in production, and `expires` equal to the
token's own `exp`. The browser never sees the token — what attaches it is the
Next proxy, on the server.

## JWT

The algorithm is pinned to HS256 both when signing **and** when verifying
(RFC 8725 §3.1), so the token's header does not choose how it is checked. The
claims are re-parsed by schema after verification, so a legitimate token in an
old shape is refused. The session is stateful: the token's `sessionVersion` must
match the user's row, and sign-in, sign-out and a password change increment it.

## CORS

Explicit allowlist, `credentials: true`, enumerated methods. A missing origin
passes — a non-browser client sends no `Origin` — and that is why
`CORS_ALLOWED_ORIGINS` is required in production: with no list, no browser
origin is accepted, and the exception relaxes local development only.

## Headers

| Where | Headers |
| --- | --- |
| API | `helmet()` with the defaults, plus `x-powered-by` turned off |
| Web, every response | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `Strict-Transport-Security`, via `headers()` in `next.config.js`, plus `x-powered-by` turned off by `poweredByHeader: false` |
| Web, page response | CSP with a per-response nonce and `strict-dynamic`, assembled in `src/proxy.ts` |

The CSP does not reach `/api` — the proxy's matcher excludes those routes — and
that is why the five headers live in `next.config.js`, which applies to
everything: a JSON response from the proxy goes out with `nosniff` even without
a CSP. `worker-src` became `'none'` when the PWA was removed (TASK 20.3).

## Rate limiting

The budgets are in `RateLimits` (`backend/src/config/Constants.ts`) and applied
by `middleware/RateLimitMiddleware.ts`. The numbers are assumed, not measured.

| Budget | Routes | Window | Limit | Key | Counts |
| --- | --- | --- | --- | --- | --- |
| `SIGN_IN_PER_ADDRESS` | sign-in | 15 min | 50 | client address | failures only |
| `SIGN_IN_PER_ACCOUNT_AND_ADDRESS` | sign-in | 15 min | 10 | email digest + client address | failures only |
| `SIGN_IN_PER_ACCOUNT` | sign-in | 1 h | 50 | email digest | failures only |
| `SIGN_UP_PER_ADDRESS` | sign-up | 1 h | 10 | client address | every attempt |
| `ACCOUNT_CHANGE` | `PATCH` and `DELETE /v1/user` | 15 min | 10 | session digest; without one, the address | failures only |
| `API` | all | 1 min | 120 | session digest; without one, the address | every request |
| `INSTRUMENT_SEARCH` | instrument search | 1 min | 30 | user id | every request |

"Failures only" is `skipSuccessfulRequests`: a response below 400 gives the
attempt back, so whoever types the right password spends nothing. A missing or
empty email falls back to the address key. IPv6 counts by the /56 prefix
(`ipKeyGenerator`), which a subscriber receives whole.

**Sign-in layers.** They run in the order of the table, and a request one of
them refuses is not counted by the following ones:

* per address: one host trying many accounts (password spraying, credential
  stuffing);
* per account and address: someone who forgot their password. It is the only
  limit a legitimate user meets, and it blocks the account for that address
  only;
* per account: attempts against one account spread over many addresses. It is
  also the cost of keeping someone else's account blocked: 50 failures per
  hour, from distinct addresses, since each address stops at 10.

Sign-up counts every attempt because each one costs a bcrypt hash and a
transaction, and it is the point where accounts are created automatically.

**Client address.** In production the browser only talks to the web, and all
traffic reaches the API from that same service: counted by the socket, the
address would be a single bucket for the whole product. The session-less routes
(sign-in and sign-up) receive two headers from the web: `x-client-address`, the
last entry of `X-Forwarded-For` — the one the platform appends, the same single
hop the API's `trust proxy` counts — and `x-api-proxy-secret`. The API believes
the address only when the secret matches `API_PROXY_SECRET` and the value is an
IP; otherwise it counts against the address that connected, which a header does
not change. The secrets are compared as SHA-256 digests with `timingSafeEqual`,
so the time does not depend on the value presented. `API_PROXY_SECRET` is
required in the API in production, and the web refuses to forward sign-in and
sign-up in production without it, recording `api.proxy_secret_missing`: with no
secret, both would fall back to a single bucket.

**What the client receives.** `429` with the generic `THROTTLED` envelope and
`Retry-After` in seconds, which the web shows as "Too many requests. Try again
in N minutes.". Nothing says which budget ran out, or whether the account
exists: an unknown email and a wrong password answer alike and are counted
alike. The sign-in and sign-up limiters send neither `RateLimit` nor
`RateLimit-Policy` — what is left of an account's budget counts the failures of
every address, and would report other people's attempts to one caller; only the
general API budget, which belongs to the caller itself, appears on those
routes.

**Backoff.** The window goes from 15 minutes, per account and address, to 1
hour, per account, and `Retry-After` says how long is left. A counter that grows
while the account remains under attack requires state outside the window
(TD-077).

**Impact on legitimate users.** Getting the password right consumes no budget,
so the limit only shows up after 10 failures in 15 minutes from the same
address, and the message says when to try again. A network behind a single NAT
— an office, a university, a carrier with CGNAT — shares 50 sign-in failures per
15 minutes and 10 sign-ups per hour; that is the point to measure before
tightening the numbers. A distributed attack against one account blocks it for
the owner too, for the rest of the 1-hour window the first failure opened.

**Other authentication surfaces.**

| Surface | Treatment |
| --- | --- |
| bcrypt cost as DoS amplification | Every password check goes through a limiter ahead of the service; a sign-in with an unknown email compares against a dummy hash, so the cost is the same and so is the counting |
| Email enumeration (TD-004) | Throughput drops to 10 probes per hour per address, through the sign-up budget |
| Blocking someone else's account | Limited to whoever controls many addresses; the owner on another address is affected only by the per-account layer |
| Address spoofing | A header without the secret, with the wrong secret, or with a value that is not an IP is ignored; the `X-Forwarded-For` the client sends sits before the entry the web uses |
| Automation with no volume limit | There is no bot challenge; within the budgets, a script is indistinguishable from a person (TD-076) |
| Multiple instances | The counters are per process; the effective limit is the budget times the number of instances (TD-006) |
| Local development | Without `API_PROXY_SECRET`, the web attests no address and every browser counts as the web container |

## Authorization

* Portfolio: `requireOwnedPortfolio` (`services/PortfolioAccess.ts`) is the only
  call to `portfolioRepository.getById({ id, userId })` outside the
  repositories. Another user's portfolio answers as non-existent, so the caller
  does not discover other people's ids.
* Transaction and asset: every read and write carries the token's `userId` in
  the `where` clause; no service resolves a resource by id alone.
* Administrator: `GET /v1/users` and the instrument catalog's writes require
  `isAdmin`, checked in the service — not in the route.
* `isAdmin`, `password` and `sessionVersion` are omitted in the query itself,
  not filtered out afterwards.

## Logs

One line per completed request, in JSON, with severity derived from the status,
`requestId`, the route as a pattern (`/v1/portfolio/positions/:symbol`, never
the symbol), duration, `userId` and the error code the client was answered
with. No email, no token, no body. A stack trace only on the 5xx error line,
which stays on the server: the client receives a generic
`{ code, message, details }`.

## Accepted risks

| Risk | Why it is still open |
| --- | --- |
| Email enumeration on sign-up (TD-004) | Answering alike for a new and an existing email requires email confirmation, a flow the product does not have |
| New password neither checked against breaches nor Unicode-normalized (TD-005) | Depends on an external source and on migrating existing accounts' hashes on the first successful sign-in |
| Per-process rate limit counters (TD-006) | The effective limit is the budget times the number of instances; solving it requires a shared store |
| No bot challenge on sign-in and sign-up (TD-076) | The budgets cap volume, they do not tell a script from a person; a challenge depends on an external service |
| No absolute cap on consecutive failures per account (TD-077) | The per-account window renews every hour; a counter that only resets on success requires persistent state |
| `style-src 'unsafe-inline'` (TD-007) | Components use the `style` attribute, which a nonce does not authorize; injected CSS changes appearance, it does not execute script |
| Unauthenticated traffic against the web is not limited (TD-065) | The API's cap protects the backend; the Next server depends on the platform |
