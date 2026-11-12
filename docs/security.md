# Security

The security posture of the application as of 2026-11-01. Each item says where
the control lives, what was verified and what remains open. What is specific to
session and password is in [`authentication.md`](authentication.md); the error
envelope is in [`errors.md`](errors.md).

This document does not claim the application is secure or free of
vulnerabilities. It records what was reviewed and how far each control was
tested: [Verified and unvalidated](#verified-and-unvalidated) separates what a
test exercised from what was only read or depends on the platform, and
[Risk register](#risk-register) lists what stays open.

## Input surfaces

| Surface | Validation | Rejection | Trust in the caller |
| --- | --- | --- | --- |
| Body and query of every `/v1` route | zod schema in `backend/src/validation/schema`, applied by `validate()` in the controller, ahead of the service; unknown keys are dropped, and no schema accepts `isAdmin` or `sessionVersion` | `400 VALIDATION` with one `{ path, message }` per refused field | none |
| `Authorization` header | `authMiddleware`: `Bearer` scheme, HS256 signature, claims re-parsed, `sessionVersion` checked against the user's row | `401 AUTHENTICATION` | none |
| `x-request-id` | `PROPAGATED_REQUEST_ID` accepts 8–64 characters of `[A-Za-z0-9-]`; anything else and the id is generated | id dropped silently, with no error | none: the value only comes back in the header and in the log |
| `Origin` | `CORS_ALLOWED_ORIGINS` allowlist, required in production | response without `Access-Control-Allow-Origin` | none |
| `x-client-address` and `x-api-proxy-secret` | `clientAddressOf` (`RateLimitMiddleware.ts`): the address counts only with the `API_PROXY_SECRET` secret and only if it is an IP | header ignored silently; the request counts against the address that connected | the web only, which proves itself with the secret |
| `x-bot-challenge` on the API | `TurnstileVerifier`: at most 2048 characters, then confirmed by Cloudflare for this site and this action | `403 AUTHORIZATION` when refused, `503 INFRASTRUCTURE` when Cloudflare gives no verdict | none: see [Bot challenge](#bot-challenge) |
| `x-bot-challenge` on the web | `botChallengeHeadersOf` (`web/src/lib/api-proxy.ts`) forwards it only when non-empty and at most 2048 characters | header dropped, so the API refuses the request | none |
| `X-Forwarded-For` in the web | `clientAddressHeaders` (`web/src/lib/api-proxy.ts`) uses the last entry only, the one the platform appends | earlier entries ignored | none: whatever the client sends sits before the platform's entry |
| Body of the web's route handlers | `jsonPayload` (`web/src/lib/api-proxy.ts`): `application/json` only, at most 100 KiB (4 MiB on the import's upload routes), counted in bytes, then parsed | `415 Unsupported Media Type` for any other media type, `413` for a declared length past the bound (unread) or a stream that runs past it (cancelled), `400 Bad Request` for a body that does not parse, all with the `{ message, _error }` envelope | none |
| Path parameters of the web's route handlers | each id or symbol goes through `encodeURIComponent`, and `forwardToApi` refuses a path with a `.` or `..` segment (`hasDotSegment`), which the upstream URL would otherwise resolve onto another route | `404 Not Found` | none |
| `Sec-Fetch-Site` and `x-ex3-csrf` on the web's `/api` routes | `isCrossSiteWrite` (`web/src/proxy.ts`): a write must carry the app's header and, when the browser reports it, say `same-origin` | `403 Forbidden` | none: see [Cross-site requests](#cross-site-requests) |
| Return path after sign-in | `RETURN_PATH_PATTERN` (`sign-in/page.tsx`): a path on this site, not `//` or `/\` and with no whitespace | the default page | none |
| Imported file (`POST /v1/transaction-import/preview` and `/v1/transaction-import`) | zod: a name of at most 255 characters without control characters, padded base64 of at most 2 MiB, at most 5000 SHA-256 keys; then the kind is decided by the bytes, not the name, and the name must end in `.xlsx` for a workbook or `.csv` for text: a ZIP read as XLSX through its central directory with inflate budgets and CRC checks, XML with no document type declaration, CSV in UTF-8, UTF-16 with a byte order mark or Windows-1252. Formulas are never evaluated. Detail in [`transaction-import.md`](transaction-import.md#security) | `400 VALIDATION` for a malformed body, `413` past the upload body; `422 DOMAIN` for a file past 2 MiB, a legacy `.xls`, a PDF, a name whose extension is not the content's, damaged content, an unrecognized layout, no rows or too many | none: the file is the person's, and every cell is data |
| Quote provider (Yahoo Finance) | fixed origin, `redirect: 'error'` and a symbol restricted to letters and digits, escaped into the URL; the response is schema-parsed before becoming a price or an instrument attribute, with name and sector length-capped; from the client, registration accepts only symbol, market and currency | infrastructure failure; the position is reported from the ledger | response treated as external data |

The body is capped at `100kb` (`RequestLimits.JSON_BODY_SIZE`) ahead of any
parsing, and a payload above that answers `413`. The two upload routes of the
transaction import skip that parser and take `4mb`
(`RequestLimits.UPLOAD_BODY_SIZE`), parsed only after authentication and their
rate limit (`BodyParserMiddleware.ts`), so no anonymous caller has a large body
parsed.

## Secrets

* `EnvsSchema` refuses the process at boot: a `JWT_SECRET` under 32 characters,
  a `BCRYPT_SALT` below 10 rounds, a `JWT_EXPIRATION` without a unit or above
  `30d`, `CORS_ALLOWED_ORIGINS` missing in production, an `API_PROXY_SECRET`
  under 32 characters or missing in production, and a `TURNSTILE_SECRET_KEY`
  missing in production or set there to one of Cloudflare's test secrets. There
  is no insecure default — what is missing brings the boot down, it does not
  silently degrade.
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
* `TURNSTILE_SITE_KEY` is public by design and reaches the page as a prop. The
  secret key is read by the backend alone and travels only in the body of a
  request to Cloudflare's fixed origin, with redirects refused. The YH Finance
  and brapi keys are sent only from the backend, each in a header to its
  provider's fixed origin, with redirects refused.

## Session cookie

`COOKIE_OPTIONS` (`web/src/common/constants.ts`): `httpOnly`,
`sameSite: 'strict'`, `secure` in production, `path: '/'`, and `expires` equal
to the token's own `exp`. The browser never sees the token — what attaches it is
the Next proxy, on the server.

In production both cookies carry the `__Host-` prefix, so a browser accepts them
only over HTTPS, with `Path=/` and no `Domain`: a sibling subdomain, or a script
on one, cannot plant or shadow them. Deleting one repeats those attributes,
because a browser drops a `__Host-` cookie sent without `Secure`, the deletion
too. Introducing the prefix renamed the cookies, which signs every production
session out once.

## Cross-site requests

`SameSite=Strict` keeps the session cookie off any request another site
starts, so no write that needs a session can be forged. Signing in and signing
up need none: until 2026-10-30 a form on another site could post an attacker's
credentials, as `text/plain` that happens to parse as JSON, and the response
would leave the visitor signed in to the attacker's account (login CSRF), where
whatever they recorded would be the attacker's to read. Three layers now close
it, and every one covers sign-out and session expiry:

* `web/src/proxy.ts` also runs on `/api`, and refuses with `403` any method
  other than `GET`, `HEAD` and `OPTIONS` that does not carry `x-ex3-csrf: 1`.
  `proxyApi`, the web's only client of these routes, sends it on every request.
  Another site cannot: a custom header makes the browser ask a CORS preflight
  first, and the web never answers one. This is what protects a browser that
  does not send `Sec-Fetch-Site`, and it covers the `POST`s without a body, which
  until 2026-10-30 relied on `Sec-Fetch-Site` alone.
* The same proxy refuses a write whose `Sec-Fetch-Site`, when present, is
  anything but `same-origin`. The browser sets that header itself, so a page
  cannot forge it.
* `jsonPayload` reads only `application/json`, so a cross-site form cannot reach
  a route that takes a body.

A client that is not a browser can set any header it likes, which forges
nothing: it holds no one's cookie, and the API still requires the session and
the challenge.

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
| API | `helmet()` with `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` and `X-Frame-Options: DENY`, since it serves no page; `Cache-Control: no-store` on every answer; `x-powered-by` turned off |
| Web, every response | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin`, via `headers()` in `next.config.js`, plus `x-powered-by` turned off by `poweredByHeader: false` |
| Web, `/api` | `Cache-Control: no-store`, set by `src/proxy.ts` on what it passes and on what it refuses |
| Web, page response | CSP with a per-response nonce and `strict-dynamic`, assembled in `src/proxy.ts` |

The CSP does not reach `/api`, and that is why the other headers live in
`next.config.js`, which applies to everything: a JSON response from the proxy
goes out with `nosniff` even without a CSP. `worker-src` became `'none'` when
the PWA was removed (TASK 20.3).

## Content Security Policy

The production policy of a page, in `web/src/proxy.ts`:

```
default-src 'self'
script-src 'self' 'nonce-…' 'strict-dynamic' https://challenges.cloudflare.com
style-src 'self' 'unsafe-inline'
style-src-elem 'self' 'nonce-…' 'sha256-…'
style-src-attr 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'
frame-src https://challenges.cloudflare.com
worker-src 'none'
object-src 'none'
base-uri 'none'
form-action 'self'
frame-ancestors 'none'
```

Script is authorized by the nonce alone, and `strict-dynamic` passes that trust
to what a nonced script loads. Turnstile is the only external origin. Development
adds `'unsafe-eval'` to `script-src` and allows inline `<style>`, which Next's
overlay and hot reload need.

**Styles are split in two.** A `<style>` element can restyle anything and is what
markup injection would use, so `style-src-elem` closes it: only this site's
stylesheets, a nonced element, or the one hashed stylesheet. A `style` attribute
styles only its own element, and a nonce cannot authorize one, so
`style-src-attr` stays `'unsafe-inline'`. `style-src 'self' 'unsafe-inline'` is
what a browser without CSP3 falls back to, which keeps the application working
there at the cost of this distinction.

| Inline style source | Kind | Authorized by |
| --- | --- | --- |
| Radix scroll lock (`react-style-singleton`) | `<style>` | nonce, through `get-nonce`, set by `NonceProvider` |
| `framer-motion` `PopChild` | `<style>` | nonce, through `MotionConfig` in `MotionScope` |
| Radix Select viewport | `<style>` | nonce prop, in `components/ui/select.tsx` |
| `next-nprogress-bar` | `<style>` | nonce prop, in `AppProvider` |
| TanStack Query devtools, development only | `<style>` | `styleNonce` prop |
| Sonner | `<style>` injected as the module loads, with no nonce option | SHA-256 of its stylesheet (`TOASTER_STYLESHEET_HASH`) |
| Turnstile | its own elements, inside its frame and on the page | nonce of the script tag it was loaded with |
| 14 data-driven `style` props in the application, plus Radix positioning, Recharts and the toaster | attribute | `style-src-attr 'unsafe-inline'` |

Replacing the attributes would mean a stylesheet per computed value or moving
the third-party libraries, and they can only alter the look of an element, not
execute script or load a resource from another origin. A `sonner` upgrade that
changes its stylesheet changes the hash; `proxy.test.ts` recomputes it from the
installed package, so the upgrade fails the suite instead of breaking toasts.

## Rate limiting

The budgets are in `RateLimits` (`backend/src/config/Constants.ts`) and applied
by `middleware/RateLimitMiddleware.ts`. The numbers are assumed, not measured.

| Budget | Routes | Window | Limit | Key | Counts |
| --- | --- | --- | --- | --- | --- |
| `SIGN_IN_PER_ADDRESS_DAILY` | sign-in | 1 day | 150 | client address | failures only |
| `SIGN_IN_PER_ADDRESS` | sign-in | 15 min | 50 | client address | failures only |
| `SIGN_IN_PER_ACCOUNT_AND_ADDRESS` | sign-in | 15 min | 10 | email digest + client address | failures only |
| `SIGN_IN_PER_ACCOUNT` | sign-in | 1 h | 50 | email digest | failures only |
| `SIGN_UP_PER_ADDRESS_DAILY` | sign-up | 1 day | 20 | client address | every attempt |
| `SIGN_UP_PER_ADDRESS` | sign-up | 1 h | 10 | client address | every attempt |
| `ACCOUNT_CHANGE` | `PATCH` and `DELETE /v1/user` | 15 min | 10 | session digest; without one, the address | failures only |
| `API` | all but the probes | 1 min | 120 | session digest; without one, the address | every request |
| `INSTRUMENT_SEARCH` | instrument search | 1 min | 30 | user id | every request |

"Failures only" gives the attempt back when the response is below 400, so
whoever types the right password spends nothing. A missing or empty email falls
back to the address key. IPv6 counts by the /56 prefix (`ipKeyGenerator`), which
a subscriber receives whole.

**Shared counters.** `RateLimitStore` (`infra/database/RateLimitStore.ts`) keeps
every budget in the `rate_limit_counters` table, so any number of API processes
counts against the same limit and a restart forgets nothing. Each hit is one
`INSERT … ON CONFLICT DO UPDATE`: the row lock serializes concurrent hits, and
the window is decided by the database clock, which all processes share. Each
process sweeps its closed windows every 10 minutes. Postgres was chosen because
the application already requires it; no new service is involved. The cost is one
more write per API request, not measured yet.

**When the store fails.** The request is refused with `503` and the failure is
logged as `rate_limit_store_failed`; it is never let through uncounted. The only
exception is giving a hit back: a failed decrement leaves the attempt counted,
which errs against the caller. The probes sit outside the limiter, so a store
failure is reported by `/ready` rather than hidden by a `503` from the limiter.

**Sign-in layers.** They run in this order, and a request one of them refuses is
not counted by the following ones:

* per address, by the day and by the window: one host trying many accounts
  (password spraying, credential stuffing). Refused challenges count here;
* the [bot challenge](#bot-challenge), so a caller who has not solved it spends
  nothing of someone else's account;
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

**Backoff.** The wait grows from 15 minutes to 1 hour to a day as an address
keeps failing, and `Retry-After` says how long is left. The daily budget stops
the slow attack the shorter windows renew for: at 50 failures per 15 minutes, an
address would otherwise reach 4800 a day. It does not bound an attack spread over
many addresses against one account, which stays at 50 failures per hour (TD-077).

**Impact on legitimate users.** Getting the password right consumes no budget,
so the limit only shows up after 10 failures in 15 minutes from the same
address, and the message says when to try again. A network behind a single NAT
— an office, a university, a carrier with CGNAT — shares 50 sign-in failures per
15 minutes, 150 per day, 10 sign-ups per hour and 20 per day; that is the point
to measure before tightening the numbers. A distributed attack against one
account blocks it for the owner too, for the rest of the 1-hour window the first
failure opened.

**Other authentication surfaces.**

| Surface | Treatment |
| --- | --- |
| bcrypt cost as DoS amplification | Every password check goes through a limiter ahead of the service; a sign-in with an unknown email compares against a dummy hash, so the cost is the same and so is the counting |
| Email enumeration (TD-004) | See [Sign-up enumeration](#sign-up-enumeration) |
| Blocking someone else's account | Limited to whoever solves the challenge from many addresses; the owner on another address is affected only by the per-account layer |
| Address spoofing | A header without the secret, with the wrong secret, or with a value that is not an IP is ignored; the `X-Forwarded-For` the client sends sits before the entry the web uses |
| Automation with no volume limit | The [bot challenge](#bot-challenge) on sign-in and sign-up, on top of the budgets |
| Multiple instances | The counters are shared; each budget holds across instances |
| Local development | Without `API_PROXY_SECRET`, the web attests no address and every browser counts as the web container |

## Bot challenge

Cloudflare Turnstile guards sign-in and sign-up, where accounts are created and
passwords guessed. It was chosen over building a heuristic because telling a
script from a person is the part that cannot be done well locally.

1. When the form submits, `BotChallenge` (`web/src/components/bot-challenge.tsx`)
   asks Turnstile for a token. Most visitors see nothing; one Cloudflare is
   unsure of is shown the challenge in place, with a prompt a live region reads,
   while the submit stays pending. The script loads only on these two pages.
2. The web forwards the token as `x-bot-challenge`.
3. `botChallengeMiddleware` has `TurnstileVerifier` ask Cloudflare's `siteverify`
   with the secret, the token, the client address and an idempotency key, with a
   5-second timeout and redirects refused. With a real secret, the answer must
   also name the action (`sign-in` or `sign-up`) and one of the hostnames in
   `CORS_ALLOWED_ORIGINS`, so a token solved elsewhere, or for the other form,
   does not pass.

| Cloudflare's answer | Verdict | Response |
| --- | --- | --- |
| Solved here, for this action | `PASSED` | the request continues |
| Token missing, invalid, expired or already spent, or solved for another action or host | `REFUSED` | `403` `Human verification failed, please try again` |
| Unreachable, timed out, an error status, an unexpected body, or a failure in the request or the secret | `UNAVAILABLE` | `503` `Human verification is unavailable, please try again later`, logged as `bot_challenge_unavailable` |

**It fails closed, by decision.** While Cloudflare cannot answer, nobody can sign
in or sign up; a session already open is unaffected, since no other route uses
the challenge. The alternative, letting requests through, would give an attacker
a way to turn the check off.

**A token is spent once.** Cloudflare answers each token once, so the form resets
the widget after every attempt, including a wrong password.

**Outside production.** Without `TURNSTILE_SECRET_KEY` the check is off and the
boot logs `bot_challenge_not_enforced`. Production refuses to boot without the
secret, or with one of Cloudflare's test secrets. Without
`TURNSTILE_SITE_KEY`, production renders no widget, logs
`bot_challenge.site_key_missing`, and the API refuses every attempt: a broken
configuration blocks access rather than opening it.

**What it does not do.** A challenge raises the cost of automation; it does not
stop a solving service or a person. It reduces attacks that the budgets then cap.

## Timing

The goal is for response time not to depend on whether an account exists. No
artificial delay is used: both paths do the same work.

* **Sign-in.** `GetUserService` verifies the password whether or not the email
  matched an account, against a digest of the configured cost, computed as the
  service is built, so no first unknown email pays for hashing it.
* **Cost changes.** A digest of another cost is rehashed after a valid password
  (`Bcrypt.needsRehash`, `UserRepository.rehashPassword`), so a change of
  `BCRYPT_SALT` converges on the new cost. The write only applies if the digest
  is still the one verified, so it cannot overwrite a password changed meanwhile.
  Until an account signs in again, its old digest keeps the old cost.
* **Sign-up.** `UserRepository.add` hashes before the insert, so a taken email
  pays the same hash as a new one. The answers differ anyway; see below.
* **Secrets.** `API_PROXY_SECRET` is compared as SHA-256 digests with
  `timingSafeEqual`. The Turnstile secret is compared by Cloudflare.

`Authentication.integration.ts` measures 15 unknown-email and 15 wrong-password
sign-ins through the real stack and requires the median of the first to be at
least 0.6 of the second. With the dummy verification removed, the test failed as
intended, at 10.0 ms against 70.3 ms. It is an in-process measurement: it
detects a regression of the mitigation, and does not prove that no difference can
be observed over a network. What remains is the single indexed lookup, which
finds a row or does not.

## Sign-up enumeration

`POST /v1/user/create` answers `409 User already exists` for a registered email,
which tells a caller that the email has an account. Answering alike would need
email confirmation, a flow the product does not have: an instant session cannot
be issued for an email that may belong to someone else. Instant sign-in was kept
by decision, and the surface was reduced instead: each probe must solve the bot
challenge and counts against 10 attempts per hour and 20 per day from an address.
Sign-in itself discloses nothing: an unknown email and a wrong password answer
the same `401`, in about the same time.

## Authentication and sessions

| Concern | Finding |
| --- | --- |
| Password storage | bcrypt through its library, cost from `BCRYPT_SALT` (10 or more), at most 72 bytes, at least 8 code points, refusing common passwords and those derived from the email. No cryptography is implemented here |
| Session creation | A token is issued only by sign-in and sign-up, with a `sessionVersion` from the database. Nothing accepts a token from a URL or a form, which rules out session fixation |
| Expiry | `JWT_EXPIRATION`, `1d` by default, up to `30d`; the cookie expires with the token |
| Rotation and revocation | Sign-in increments `sessionVersion`, so an account has one live session; sign-out and a password change revoke it in the same write |
| Token exposure | `httpOnly` cookie, stripped from what the web returns, never in a URL or a log |
| Token replay | A token stolen in transit or from a server is valid until the next sign-in, sign-out, password change or expiry. It is not bound to a client; HTTPS, `HttpOnly` and `__Host-` reduce how it could be stolen |
| Password confirmation | `PATCH` and `DELETE /v1/user` verify the current password and are throttled |
| Recovery and email verification | Neither flow exists, so there is no reset or confirmation token to expire or reuse. A future flow must use short-lived, single-use tokens stored as digests |
| MFA | Not implemented, and recommended next. The application holds a person's financial records, not their money, so a password stays defensible for now, but a stolen password reads everything. TOTP needs no external service; it does need enrollment, encrypted seed storage and recovery codes, and recovery depends on a flow that does not exist yet |

## Authorization

* Portfolio: `requireOwnedPortfolio` (`services/PortfolioAccess.ts`) is the only
  call to `portfolioRepository.getById({ id, userId })` outside the
  repositories. Another user's portfolio answers as non-existent, so the caller
  does not discover other people's ids.
* Transaction, asset and finances: every read and write carries the token's
  `userId` in the `where` clause; no service resolves a resource by id alone.
* Administrator: `GET /v1/users` and the instrument catalog's writes require
  `isAdmin`, checked in the service — not in the route.
* `isAdmin`, `password` and `sessionVersion` are omitted in the query itself,
  not filtered out afterwards.
* Only sign-in, sign-up and the probes answer without a session. The web has no
  server actions, and its route handlers only forward to the API, which decides.
* Background work is limited to sweeping expired rate limit counters; nothing
  runs on a user's data outside a request.
* Isolation lives in the application. There is no Postgres row-level security:
  the API connects with one role, and enforcing tenancy in the database would
  mean setting the user on every connection of a pool. The integration suite
  holds at least 34 tests that act on another user's data, across 7 files.

## Financial integrity

* **Precision.** Money, quantities and rates are `Decimal(38, 18)` columns,
  handled with decimal arithmetic in the domain, with no `Float` column and no
  `parseFloat`. Rounding and date rules are in
  [`financial-rules.md`](financial-rules.md); values are truncated, never rounded
  up, and windows close at the start of the current day in UTC.
* **Atomicity and concurrency.** A financial write that touches more than one
  table runs in one `runSerializable` transaction, retried on a serialization
  conflict. Tests make the last write fail and confirm the rollback, and cover
  concurrent sales and payments; see
  [`testing.md`](testing.md#atomicity-of-financial-operations).
* **Duplicate submissions.** There is no idempotency key. The forms disable
  submit while pending and no mutation retries on its own, but a client that
  repeats a request after a lost response records it twice. Nothing moves money,
  and the person can delete the duplicate; see the [register](#risk-register).
* **Imports.** An import is recorded whole in one serializable transaction,
  after planning again against the portfolio as it is then; each row's key is
  unique per portfolio, so the same row is never recorded twice, even by two
  concurrent imports. Undo is refused, touching nothing, when what is left would
  not replay. See [`transaction-import.md`](transaction-import.md#recording).
* **Tampering.** A position is rebuilt from the ledger, so a client cannot state
  one directly, and the ownership checks above apply to every write.

## Logs

One line per completed request, in JSON, with severity derived from the status,
`requestId`, the route as a pattern (`/v1/portfolio/positions/:symbol`, never
the symbol), duration, `userId` and the error code the client was answered
with. No email, no token, no body. A stack trace only on the 5xx error line,
which stays on the server: the client receives a generic
`{ code, message, details }`. In production the logs stay on the host, in
Docker's `local` driver, at most 5 × 10 MB per service
([`deployment.md`](deployment.md#topology)); see
[Assumptions and operational requirements](#assumptions-and-operational-requirements).

## Other attack vectors

Reviewed against the OWASP Top 10 and the OWASP API Security Top 10, in the
context of this architecture.

| Vector | Applies | Treatment |
| --- | --- | --- |
| SQL injection | yes | Prisma parameterizes queries; raw SQL is written only as tagged templates, which bind values. `$executeRawUnsafe` appears only in the test harness, with quoted identifiers |
| NoSQL injection | no | There is no NoSQL store |
| Command injection | no | The runtime spawns no process; `child_process` appears only in tests |
| XSS | yes | React escapes output; there is no `dangerouslySetInnerHTML`, `innerHTML` or `eval`; the CSP authorizes script by nonce |
| CSRF | yes | [Cross-site requests](#cross-site-requests) |
| Cross-origin reads | yes | CORS allowlist; COOP and CORP on the web |
| Clickjacking | yes | `frame-ancestors 'none'` and `X-Frame-Options` |
| SSRF | limited | Outbound requests go to two fixed origins, with redirects refused; a symbol is restricted and escaped, and no URL comes from a caller |
| Broken authentication | yes | [Authentication and sessions](#authentication-and-sessions) |
| BOLA, BFLA, privilege escalation | yes | [Authorization](#authorization) |
| Mass assignment (BOPLA) | yes | Schemas drop unknown keys, none accepts a privilege field, and queries omit credential columns from responses |
| Brute force, stuffing, spraying | yes | [Rate limiting](#rate-limiting) and [Bot challenge](#bot-challenge) |
| Open redirect | yes | `RETURN_PATH_PATTERN` accepts only a path on this site; other redirects are fixed |
| HTTP request smuggling | platform | No custom parsing; Node's HTTP parser and Next serve requests. Whether a front proxy disagrees with them can only be tested in the deployed environment |
| Path traversal | limited | No file is read from a request's input, and the entry names of an imported workbook are only looked up inside the archive in memory; `hasDotSegment` stops a route-level traversal in the web's upstream paths |
| File upload and insecure file handling | yes | The transaction import takes one XLSX or CSV file of at most 2 MiB as base64 in JSON, after authentication and its rate limit. Its kind is decided by its bytes and its name's extension must agree; it is read in memory under size and entry budgets, never stored, never executed, and its formulas are never evaluated ([Transaction import](transaction-import.md#security)). There are no `multipart` parsers, and nothing is written to disk |
| Cache poisoning and leakage | yes | The API and `/api` answer `no-store`; pages are dynamic. Nothing is built from `Host` or `X-Forwarded-Host`. The nonce rules out a shared cache of a page |
| Insecure deserialization | limited | JSON only, capped, then schema-parsed; an imported workbook's XML is scanned with document type declarations refused, so no entity is defined or expanded; no YAML or serialized objects |
| Prototype pollution | limited | No recursive merge of request bodies; schemas return new objects of known keys |
| Information disclosure | yes | Generic errors, no stack traces, `x-powered-by` off, no production browser source maps, `/ready` does not say what failed |
| Supply chain | yes | [Dependencies](#dependencies-and-supply-chain) |
| Race conditions and duplicates | yes | [Financial integrity](#financial-integrity); a concurrent sign-up for one email creates one account |
| Token replay | yes | The session's `sessionVersion`; Turnstile tokens are single-use, and JWT replay is in [Authentication and sessions](#authentication-and-sessions) |
| Resource exhaustion | yes | Body cap, `Pagination.MAX_SIZE`, length-capped text, the 72-byte password limit, budgets and outbound timeouts. Traffic against the web is the gap (TD-065) |
| Unrestricted sensitive business flows | yes | Sign-up: challenge and every-attempt budgets |
| Unsafe consumption of third-party APIs | yes | Provider and `siteverify` answers are schema-parsed; a failure is `UNAVAILABLE`, never success |
| Security misconfiguration | yes | Boot refuses an unsafe configuration; containers run as a non-root user, and in production on a read-only filesystem, with no capabilities and no published port |
| Improper inventory | yes | [`api-inventory.md`](api-inventory.md) lists the routes; there is no older API version |
| Logging and monitoring failures | yes | [Logs](#logs) and [Monitoring](#monitoring-and-reassessment) |
| Server actions | no | The web defines none |

## Dependencies and supply chain

* CI runs `pnpm audit --audit-level=high` for both packages, and installs use
  `--frozen-lockfile`.
* `.github/dependabot.yml` opens weekly updates for npm, GitHub Actions and
  Docker, grouping minor and patch versions, and holds a new release for 7 days,
  so a compromised version is less likely to be taken up immediately.
* Install scripts run only for the packages `allowBuilds` names: `esbuild` in the
  web, and also `bcrypt` and Prisma's in the backend.
* The only package added by this work is `get-nonce` 1.0.1, the channel
  `react-style-singleton` already reads for its nonce.
* As of 2026-11-01 `pnpm audit --prod` reports nothing in either package. The
  full audit reports one moderate advisory, GHSA-g3hv-75wg-m249 in `minimatch`,
  only through `eslint`. It runs on the repository's own glob patterns, not on
  input from a user, and the patched major does not fit what `eslint` requires, so
  forcing it would risk the toolchain; it waits for `eslint`.
* Dockerfile base images are pinned by tag, not by digest.

## Risk register

Severity is the harm if exploited, likelihood how plausible that is given the
controls in place. These are judgments, not measurements.

| Id | Risk | Severity | Likelihood | Potential impact | Status |
| --- | --- | --- | --- | --- | --- |
| TD-006 | Per-process rate limit counters | — | — | The limit multiplied by the number of instances | **Resolved**: shared Postgres store, tested across store instances |
| TD-076 | No bot challenge on sign-in and sign-up | — | — | Unlimited automation within the budgets | **Resolved**: Turnstile, verified on the server; the widget still needs a browser check |
| TD-007 | `style-src 'unsafe-inline'` | Low | Low | Altered appearance of an element, after a separate markup injection | **Reduced**: `<style>` closed by nonce and hash in production; `style` attributes remain allowed |
| TD-077 | No absolute cap on failures per account | Medium | Low | Guessing a weak password from many addresses, at 50 per hour; the owner blocked meanwhile | **Reduced**: challenge and daily budget per address; distributed attempts remain |
| TD-004 | Email enumeration on sign-up | Low | Medium | Confirms an email has an account, which aids phishing and stuffing | **Reduced, accepted**: challenge and 20 probes per address per day; closing it needs email confirmation |
| TD-005 | New passwords not checked against breaches, no Unicode normalization | Medium | Medium | A password reused from a breach passes; the same password typed in another composition fails | **Open**: needs an external source and a hash migration |
| — | No MFA | Medium | Low | A stolen password gives full access to a person's records | **Open**: recommended next |
| TD-065 | Unauthenticated traffic against the web is not limited | Medium | Medium | The Next server is exhausted; the API's budgets do not cover it | **Reduced**: a Cloudflare rate limiting rule, 100 requests per 10 seconds per address ([`deployment.md`](deployment.md#cloudflare)); the threshold is not yet measured against real traffic |
| — | Production shares its host with development | High | Medium | Anything that compromises a development tool, package or agent session reads the database password and `JWT_SECRET` | **Accepted for now** ([`deployment.md`](deployment.md#accepted-risks)): a host of its own removes it |
| — | No database backup | High | Low | A dropped table or a broken migration cannot be undone | **Open**: Supabase Pro or a nightly dump ([`deployment.md`](deployment.md#backups)) |
| — | Tenant isolation only in the application | High | Low | One missing `userId` filter exposes another person's data | **Mitigated**: single access path and cross-user tests; no row-level security |
| — | Duplicate submission without idempotency | Low | Low | A repeated record, which the person can delete | **Open, accepted**: no money moves |
| — | A crafted spreadsheet occupying the API | Medium | Low | One request holds CPU and up to tens of MiB while a file is inflated and read | **Mitigated**: signed-in callers only, 30 requests a minute, 2 MiB files, inflate, row, column and cell budgets, linear-time XML; not measured under load |
| — | Session token not bound to a client | Medium | Low | A stolen token works until revoked or expired | **Accepted**: the cookie's attributes and one live session limit it |
| — | Cloudflare outage | Medium | Low | Nobody can sign in or up; open sessions continue | **Accepted**: failing closed is the decision |
| — | Shared address behind NAT or CGNAT | Low | Medium | Legitimate people share a budget and meet `429` | **Accepted**: measure before tightening |
| — | `minimatch` advisory in development tooling | Low | Low | Slow lint on a crafted glob, which no user supplies | **Accepted**: waits for `eslint` |

## Assumptions and operational requirements

* TLS terminates ahead of the web, and the platform appends the real client as
  the last `X-Forwarded-For` entry, with exactly one hop ahead of each service.
  If that changes, `trust proxy` and `clientAddressHeaders` must change with it.
  In production ([`deployment.md`](deployment.md)) that is Cloudflare through
  `cloudflared`, which is reported to append the client last; the first
  deploy's checks confirm it.
* The API is reachable only by the web. Otherwise `API_PROXY_SECRET` is what
  stands between a direct caller and a forged client address. In production
  the two share an internal network that nothing else joins.
* The database holds the rate limit counters; while it is down, the API answers
  `503`. In production it is Supabase, whose pooler accepts connections from the
  internet: the password, and TLS checked against Supabase's CA by both the API
  and the migrations, protect it. Its Data API is off, and RLS with no policy
  keeps its API roles out of every table; the app connects as the tables'
  owner, which RLS does not restrict. Restricting it to the VPS's address would also
  shut out GitHub's runners, which apply the migrations from changing
  addresses.
* Production sets `JWT_SECRET`, `API_PROXY_SECRET`, `CORS_ALLOWED_ORIGINS` and
  `TURNSTILE_SECRET_KEY` on the API, and `API_PROXY_SECRET` and
  `TURNSTILE_SITE_KEY` on the web. The Turnstile hostnames must include the
  production host named in `CORS_ALLOWED_ORIGINS`.
* The `20261030000000_rate_limit_counters` migration runs before the new API
  serves traffic. Until then, every limited route answers `503`.
* The `20261104000000_transaction_imports` migration runs before the new API
  serves traffic; until then, reading or writing a transaction fails.
* A person's address goes to Cloudflare as `remoteip` when a challenge is
  verified. The privacy notice should say so.
* Cloudflare owns the TLS configuration and volumetric protection; the host
  keeps the logs. Rotating `JWT_SECRET` signs everyone out.

## Monitoring and reassessment

Alert on these events:

| Event | Severity | Means |
| --- | --- | --- |
| `rate_limit_store_failed` | ERROR | The limiter is refusing requests; check the database |
| `bot_challenge_unavailable` | ERROR | Sign-in and sign-up are refused; check Cloudflare and the secret |
| `bot_challenge_not_enforced` | WARNING | The check is off; must never appear in production |
| `bot_challenge.site_key_missing` | web error | Production cannot sign anyone in |
| `api.proxy_secret_missing` | web error | Production cannot forward sign-in or sign-up |

Nothing raises these alerts in production yet: the events are read with
`ex3-prod logs` ([`deployment.md`](deployment.md#operating)).

Also watch the rate of `429` and `403` on sign-in and sign-up, which is how an
attack or a budget set too tight would first show, and the latency the counters
add to each request. Measure `rate_limit_counters` for size and write contention
under real traffic.

Reassess this document at least every 6 months, and whenever authentication,
authorization, the deployment topology or a third-party integration changes.
Review Dependabot's updates weekly. Commission a penetration test before opening
the product to a wider audience, and run a DAST scan against a staging
environment, which was not available for this review.

## Verified and unvalidated

**Implemented and verified by tests that ran on 2026-11-04.** 421 backend unit
tests, 434 backend integration tests against Postgres, and 224 web unit tests,
all passing, along with type checks, ESLint and Prettier in both packages.

* Rate limiting: concurrent attempts admit exactly the budget; a count made by
  another store instance is enforced; the daily budgets escalate; a failing store
  answers `503`; the probes stay outside the budget.
* Bot challenge, against a stand-in for Cloudflare: solved, missing, replayed and
  wrong-action tokens, the verdict while Cloudflare is unreachable, and that an
  unsolved attempt spends only its own address's budget.
* Timing: the median comparison above, with a negative control. Digest rehash,
  including the race with a password change.
* CSRF: cross-site, same-site and missing-header refusals, on sign-in, sign-out
  and `PATCH /api/v1/user`; refused media types.
* Headers and cookies as objects: `no-store` on the API and on the proxy's
  responses, cookie deletion attributes, the CSP's directives, a fresh nonce per
  page, and the sonner hash recomputed from the installed package.
* Sessions: expired, unsigned, wrongly signed and revoked tokens are refused.
* Authorization: cross-user reads and writes, anonymous access, admin routes.
* Financial writes: rollback on failure, concurrent sales and payments.
* Transaction import: crafted archives and XML (document type declarations,
  inflate past budget or declared size, wrong checksums, unclosed markup in
  linear time), legacy and PDF signatures, a name whose extension is not the
  content's, the upload body refused anonymously
  before parsing and past 4 MiB, the 100 KiB limit kept elsewhere, cross-user
  imports and instruments, and a file imported twice recorded once.

**Verified by inspection of the production build.** `next build` succeeds with
this policy. The Sonner stylesheet in the built chunk hashes to
`TOASTER_STYLESHEET_HASH`, and every `<style>` injector in the client chunks is
accounted for in the [inventory](#content-security-policy), beyond React's own
path for hoisted styles, which the application does not use.

**Reviewed by reading only, without a dedicated test.** The vector table above,
log contents, secrets in client bundles, and the correctness of rounding.

**Not validated.**

* No real browser. The Turnstile widget, its interaction-only layout and its
  behaviour under this CSP and these cross-origin headers; whether the policy
  produces violations at runtime,
  including inline styles Next may emit into the HTML; and whether `__Host-`
  cookies are accepted and deleted as intended.
* No running production server. `NextResponse.next({ headers })` reaching clients
  with `no-store` is tested on the response object, not on a served response.
* No real Cloudflare verdict: `siteverify` is stubbed throughout.
* Several instances were simulated by separate stores in one process, not by
  separate processes or machines.
* The latency of a Postgres write per request, and the budgets, are unmeasured.
* No real B3 export was parsed, and the import's time and memory on a file at
  its limits were not measured.
* No DAST scan and no penetration test were run.
* Smuggling, TLS, and the `X-Forwarded-For` assumptions need the deployed
  platform.
