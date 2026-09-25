# Authentication

The strategy adopted in PHASE 1, implemented over the existing architecture
(JWT + `httpOnly` cookie + Next.js proxy). Revised after TASK 3.2, when the
authentication tests exposed failures of session, password policy and data
exposure; after TASK 3.3, which fixed the non-atomic sign-up, the validation of
`JWT_EXPIRATION` and the sign-out in the web's interceptor; and in the review of
those fixes, which capped `JWT_EXPIRATION`, made account deletion atomic and
replaced the web's static CSP with a nonce-based one.

## Model: a single stateful session with an expiring token

The JWT is still the credential's bearer, but it is not enough on its own. A
request is authenticated when **all** of these hold:

1. the header is `Authorization: Bearer <token>`;
2. the signature checks out against `JWT_SECRET` under **HS256**. The algorithm
   is pinned at issue time and at verification time (RFC 8725 §3.1), never
   chosen by the token's own header;
3. the token has not expired (`exp`);
4. the claims have the expected shape: `sub` (the user's id) and
   `sessionVersion` (an integer ≥ 0);
5. `sub` identifies an existing user (looked up by primary key);
6. the token's `sessionVersion` equals `users.sessionVersion`.

Condition 6 is the revocation point. Sign-in, sign-out and a password change
increment `users.sessionVersion` in a single `UPDATE`, and every token issued
before stops being valid at that same instant, with no block list. Sign-up does
not increment: it issues the first token with the initial version of the row it
has just created.

**Invariant:** each version of a user is issued to at most one token. Outside
sign-up, a token is only issued right after the increment, with the value the
increment returned; the `UPDATE ... increment` serializes on Postgres's row
lock, so concurrent requests get distinct versions. The initial version is only
issued by the call that created the row, and no increment returns to it. Two
tokens never coincide, even when issued in the same second.

**The database stores no session credential.** A leak of the `users` table
exposes a counter, not usable tokens; forging a token requires `JWT_SECRET`.

## Decisions item by item

| Item | Decision | Where |
| --- | --- | --- |
| **Expiry** | Every token expires after `JWT_EXPIRATION` (default `1d`, ceiling `30d`). The value is validated at boot: a positive integer followed by `s`, `m`, `h` or `d`, converted to seconds and handed to `jsonwebtoken` as a number. A number without a unit is rejected, because `jsonwebtoken` reads `"3600"` as milliseconds and would silently shorten the session a thousandfold. The ceiling comes from NIST SP 800-63B, which limits a password-only authenticated session (AAL1) to 30 days before requiring re-authentication; with no refresh, it is the expiry that forces that re-authentication. An invalid value keeps the application from starting. Before this task the tokens never expired | `config/EnvsSchema.ts`, `infra/cryptography/Jwt.ts` |
| **Revocation** | Server-side, by incrementing `users.sessionVersion`. It applies to sign-out, a new sign-in and a password change | `infra/database/UserRepository.ts` |
| **Refresh** | **There is no refresh token.** Once the session expires, the user authenticates again. A second long-lived token would widen the attack surface without solving a problem the product has today | — |
| **Logout** | `POST /v1/user/sign-out` increments `users.sessionVersion`; the proxy calls that endpoint and only then clears the cookie | `routes/UserRoutes.ts`, `web/src/app/api/v1/sign-out/route.ts` |
| **Concurrent sessions** | **Not supported, by decision.** One version per user holds: signing in on a second device drops the first. Supporting N sessions requires a sessions table, a model change that does not belong to this phase | `infra/database/UserRepository.ts` |
| **Sign-up** | The body requires `baseCurrency`, an ISO 4217 code, and accepts an optional `portfolioName`, with the name limits of `CreatePortfolioSchema` (trimmed, 1 to 60 characters, blank refused with `400`); the user's first portfolio takes that name, or `Main` without it, in that currency. The web's form asks for the name, prefilled with `Main`, and offers BRL, USD and EUR. User and portfolio are a single Prisma nested write, executed in one transaction: no failure leaves a user without a portfolio. The unique index on `email` is the only authority on whether the address is free, with no prior query subject to a race; the violation (`P2002`) answers `400 User already exists`, and of concurrent sign-ups for the same email exactly one creates the account. Any other database failure propagates as an internal error | `validation/schema/user/CreateUserSchema.ts`, `infra/database/UserRepository.ts`, `services/user/CreateUserService.ts` |
| **Invalid token** | `401 AuthenticationError`, with a message distinguishing an invalid token, an expired token and a revoked session | `middleware/AuthMiddleware.ts` |
| **Invalid credentials** | `POST /v1/user` answers `401 Invalid email or password` for both a wrong password and a non-existent email. For a non-existent email, bcrypt checks the password against a dummy hash of the same cost, so not even the response time tells the cases apart | `services/user/GetUserService.ts` |
| **Password change** | `PATCH /v1/user` only accepts `newPassword` accompanied by the correct `oldPassword`. The new password and the version increment go in the same `UPDATE`, which revokes the current session. The `PATCH /api/v1/user` proxy clears the cookie in that same response, and the web goes back to sign-in for entry with the new password | `validation/schema/user/UpdateUserSchema.ts`, `infra/database/UserRepository.ts`, `web/src/app/api/v1/user/route.ts` |
| **Account deletion** | `DELETE /v1/user` requires the current password and removes the user, all of their portfolios, assets and transactions in a single serializable transaction, dependents first: neither a failure nor a concurrent write leaves data without an owner, and the account's token stops authenticating by condition 5. Before, an account with assets answered 500 | `infra/database/UserRepository.ts` |
| **Throttling** | Sign-in counts failures only, in three layers: 50 per address and 10 per account and address every 15 min, 50 per account every hour. Sign-up counts every attempt, 10 per address every hour. `PATCH` and `DELETE /v1/user` check the password and count 10 failures per session every 15 min: a stolen session cannot become a password-guessing oracle. The address is the client's, which the web attests with `API_PROXY_SECRET`; `429` carries only the generic envelope and `Retry-After`. Details in `security.md`, §Rate limiting | `routes/UserRoutes.ts`, `middleware/RateLimitMiddleware.ts` |
| **Data exposure** | `password` and `sessionVersion` never leave in responses: the repository omits them in the query itself (Prisma's `omit`), including in `GET /v1/users`, which is admin-only. `GET /v1/user` returns only the caller's own profile and also omits `isAdmin`; an account that has ceased to exist answers `401` | `infra/database/UserRepository.ts`, `services/user/GetCurrentUserService.ts` |

## Password policy

Applied to new passwords (sign-up and password change) in
`backend/src/validation/schema/user/PasswordSchema.ts` and, for the email rule,
in `backend/src/domain/PasswordPolicy.ts`:

| Rule | Value | Rationale |
| --- | --- | --- |
| **Minimum** | 8 characters, counted in Unicode code points | A product decision (2026-09-23). NIST SP 800-63B-4 §3.1.1.2 asks for 15 for a password used as the only factor, which is this app's case since it has no MFA, and 8 only alongside a second factor. 8 is the floor of the 800-63B-3 profile, which compensates with the refusals below and with sign-in throttling |
| **Maximum** | 72 UTF-8 bytes | bcrypt digests only the first 72 bytes and ignores the rest. Rejecting avoids storing a password weaker than it looks (OWASP Password Storage Cheat Sheet) |
| **Blank** | Rejected | A password of spaces alone, of any length |
| **One repeated character** | Rejected | `aaaaaaaa` meets the minimum and is among the first attempts of a dictionary attack |
| **Common password** | Rejected, case-insensitively | A curated list of the passwords that published breach rankings put at the top, only those above the minimum (NIST SP 800-63B §3.1.1.2). It is not a breach corpus: see limitation 3 |
| **Derived from the email** | A password that contains, case-insensitively, the part of the email before the `@` is rejected when that part is 4 characters or longer | A context-specific word (NIST SP 800-63B §3.1.1.2): the email names the account. Below 4 characters the part is too generic and would refuse passwords unrelated to it. Sign-up checks it in the schema; a password change checks it in the service, against the account's email, and answers `400` with the detail on `newPassword` |
| **Normalization** | None, not even `trim` | The password is used exactly as received (OWASP ASVS): the validated value is the stored value and, later, the verified one |

Passwords submitted for verification (sign-in, account deletion, `oldPassword`)
only need to be non-empty and at most 255 characters, the previous limit; that
way accounts created under the old policy still get in. The web's sign-up and
password-change forms mirror the policy, minus the common-password list, which
only the backend has, and mark the minimum and the email rule as the password is
typed; the authority is the backend.

## Coherence between the Next proxy and the backend

Before, the Next proxy (`web/src/proxy.ts`, `middleware.ts` up to Next 16)
authenticated by the cookie's **presence**: an expired or revoked token let the
user navigate until the first API call failed with 401.

Now the proxy decodes the token's payload and checks `exp` before releasing the
route; if it has expired, it redirects to sign-in **and clears the cookie**. The
redirect carries the requested path, with its query, in `next`, except when it
is the Overview, and `reason=session-expired` when there was a token or the
session marker described below. The URL comes from `signInRouteFor`, in
`web/src/common/constants.ts`, the same one the interceptor below uses.

**The proxy does not verify the signature.** It is a UX gate, not a security
boundary. The authority is still the backend, which validates signature, expiry
and an active session; a forged token passes the proxy and is rejected on the
first API call.

In addition, the session cookie receives an `expires` derived from the token's
own `exp` (`web/src/lib/session.ts`), so that the browser discards the
credential at the same instant the API stops accepting it.

**Expiry and sign-out are told apart by a marker.** With the cookie discarded by
the browser on expiry, the proxy had no way to tell an expired session from one
the user ended: a real expiry reached sign-in with no notice. And a manual
sign-out showed the expiry notice: `useLeaveSession` removed the cache with the
protected screens still mounted, React Query redid the observed queries, the
web's proxy answered 401 for lack of a token, and the interceptor treated that
401 as an expiry. A password change had the same defect. The fix has three
parts:

* sign-in and sign-up store, alongside the token, the `ex3:session` cookie
  (`httpOnly`, same options), which lasts the token plus 7 days
  (`SESSION_EXPIRY_NOTICE_MS`, an assumed value). Only sign-out and a password
  change clear it earlier, through `clearSessionCookies`; the proxy never clears
  it, because a prefetch of a protected route would consume it before the
  navigation;
* the proxy and the interceptor ask for the notice when there is a token or a
  marker. With neither, whoever ended the session was the user, in this tab or
  another;
* the React Query cache is discarded by the public layout
  (`SessionCacheDisposal`), on mount, once the protected screens have unmounted
  and no query has an observer.

On the client, the axios interceptor (`web/src/lib/axios/axios.ts`) treats a 401
as a rejected session: it calls `POST /api/v1/session/expire`, which clears the
token cookie, keeps the marker and answers `{ hasSessionExpired }`, and reloads
at sign-in with the current page in `next` and, if `hasSessionExpired`,
`reason=session-expired`. Clearing the token is what keeps the proxy from
sending a revoked token that has not expired yet back to the Overview. The
interceptor no longer calls `/v1/sign-out`: revoking a token the API has just
rejected has no effect, and the sign-out would clear the marker. The exceptions
are `/v1/sign-in` and `/v1/sign-up`, where a 401 means a refused credential and
must reach the form, and `/v1/session/expire` itself, so that expiry does not
recurse. Concurrent 401s share a single expiry, with a single redirect.

With `reason=session-expired`, sign-in shows "Your session expired. Sign in
again to continue." above the form; the toast the interceptor used to show was
lost in the reload. On entry, the web goes to `next` if it is a path of this
origin — it starts with a single `/`, with no `\` right after, no space, tab or
line break, which the URL parser would discard to form `//host` — and to the
Overview otherwise. `next` arrives through the address bar, so it is validated
on the sign-in page, on the server, before reaching `router.push`.

The profile shown comes from `GET /api/v1/user`; `localStorage` stores no user
data. Every entry into the public area discards the React Query cache, so that
one account's data does not show up for the next one in the same tab.

**Content-Security-Policy.** The `httpOnly` cookie is not readable by script,
but an injected script would still make authenticated calls through the web's
origin. The proxy emits each page's CSP with a fresh nonce per response: only
script that Next.js marked with that nonce, or that a marked script loaded
(`'strict-dynamic'`), runs, and the browser only fetches resources from the
origin itself. That is why every route renders per request (`await connection()`
in the root layout), since a page pre-rendered at build time would have no
nonce. `'unsafe-eval'` exists in development only. The previous static CSP, in
`next.config.js`, allowed `'unsafe-inline'` and `'unsafe-eval'` in `script-src`,
which nullified it against XSS; it went out together with `X-XSS-Protection`,
which is obsolete.

## Test coverage

Unit, in `backend/src/infra/cryptography/Jwt.test.ts`,
`backend/src/middleware/AuthMiddleware.test.ts` and
`backend/src/config/EnvsSchema.test.ts`:

* a token with the current session version → authenticates;
* a missing or malformed header → 401;
* an expired token → 401 with an expiry message;
* a token signed with another secret, or with the right secret under another
  algorithm (HS512) → 401;
* an authentic token with claims in another shape (the legacy `{ id }` payload,
  `sessionVersion` as a string) → 401;
* a superseded session version, or a non-existent user → 401 for a revoked
  session;
* `JWT_EXPIRATION`: each unit converted to seconds; the ceiling accepted in `d`,
  `h` and `s`; empty, a number with no unit, an unknown unit, a fraction,
  surrounding spaces, zero, negative, a leading zero and a value above `30d` in
  any unit → rejected.

End to end, against the database and through the HTTP API, in
`backend/src/routes/Authentication.integration.ts`:

* **sign-up:** a token that authenticates immediately and a portfolio created in
  the chosen currency, a missing or unknown base currency refused without
  creating an account, an email already registered in any case, concurrent
  sign-ups for the same email (exactly one creates an account and a portfolio),
  the boundaries of 15 code points and 72 bytes, a blank password, spaces
  preserved as part of the password;
* **sign-in:** a generic 401, an identical response for a non-existent email, a
  bcrypt check in that case too, a distinct token on each sign-in with
  revocation of the previous one;
* **tokens:** invalid (another secret, `alg: none`, the legacy payload, a
  non-JWT value) and expired;
* **sign-out.**
* **account deletion:** it removes the account with every portfolio, asset and
  transaction, without touching another account, and ends the session; a wrong
  password removes nothing;
* **password change:** it revokes the session, requires the current password,
  applies the policy and is bounded by the account-change throttling;
* **profile:** the caller receives their own profile, not another account's,
  with no credential columns and no `isAdmin`;
* **user listing:** an admin receives the list with no credential columns; a
  non-admin receives 403;
* **protected routes:** anonymous rejection on all of them.

## Migration

`backend/prisma/migrations/20260911000000_session_version` removes
`users.accessToken` and adds `users.sessionVersion INTEGER NOT NULL DEFAULT 0`.
Effects on deployment:

* tokens issued earlier (the `{ id }` payload) fail claim validation, so every
  user authenticates again once;
* passwords registered with surrounding spaces were stored without them, because
  the backend and the web both applied `trim`. Since the comparison is now
  exact, those users get in by typing the password without the spaces.

A `JWT_EXPIRATION` with no unit that used to boot (and expired in milliseconds)
now prevents the boot, and needs its unit added in the environment before
deployment. The same goes for a value above `30d`, which has to be lowered.

## Known limitations and accepted risks

1. **With no refresh, a `JWT_EXPIRATION` that is too high weakens revocation by
   expiry and one that is too low degrades the UX.** The `1d` default is the
   assumed middle ground; it is configurable per environment up to the `30d`
   ceiling.
2. **Email enumeration on sign-up.** `POST /v1/user/create` answers
   `User already exists` for an already registered email. Eliminating that
   requires email confirmation, a flow the product does not have. Throughput is
   10 probes per hour per address, the sign-up budget, which counts every
   attempt.
3. **The common-password list is not a breach corpus.** NIST SP 800-63B-4 asks
   for new passwords to be compared against compromised ones; the curated list
   covers only the most frequent, and a leaked password outside it is accepted.
   With the minimum at 8, that comparison weighs more; it is in TD-005.
4. **No Unicode normalization.** The same password typed with different
   compositions (a pre-composed `é` vs. `e` + a combining accent) does not
   match. Normalizing changes the verified value of existing accounts; evaluate
   it together with item 3.
5. **Counters in process memory.** With more than one backend instance, each one
   applies the whole budget, and the effective limit is the budget times the
   number of instances. A shared store solves it; it is in TD-006. The keys are
   in `security.md`, §Rate limiting.
6. **A residual timing difference if `BCRYPT_SALT` changes.** Old hashes keep
   the old cost, while the dummy hash uses the current one.
7. **`style-src 'unsafe-inline'` in the CSP.** Components use `style`
   attributes, which a nonce does not authorize. Where there is markup
   injection, injected CSS can change the interface, but it neither executes
   script nor loads a resource from another origin.
