# Error taxonomy

Every failure the API reports falls into one of eight categories. The category
name is the envelope's `code`: stable across versions, it is what a client
branches on and what groups a log by what happened.

## The categories

| `code` | Status | Means | Class |
| --- | --- | --- | --- |
| `VALIDATION` | 400 | the input is not acceptable: shape, type, range or format | `ValidationError` |
| `VALIDATION` | 413 | body above `RequestLimits.JSON_BODY_SIZE` | — (`express.json`) |
| `AUTHENTICATION` | 401 | no usable identity: credential missing, malformed, expired or superseded | `AuthenticationError` |
| `AUTHORIZATION` | 403 | the caller is known and may not do this | `AuthorizationError` |
| `NOT_FOUND` | 404 | nothing the caller may see answers for that address | `NotFoundError` |
| `CONFLICT` | 409 | the request is valid and collides with what is already stored | `ConflictError` |
| `DOMAIN` | 422 | every field is valid and a domain rule refuses the operation | `DomainError` |
| `INFRASTRUCTURE` | 429 | capacity limit: the caller exceeded the window's budget | — (`RateLimitMiddleware`) |
| `INFRASTRUCTURE` | 503 | a dependency is not answering: readiness refusing the instance | — (`/ready`) |
| `INTERNAL` | 500 | unforeseen failure, reported without internal detail | — (error boundary) |

Category and status are independent axes. That is why two catalog entries share
`VALIDATION`: a body that is too large is an input refusal answered with 413,
not a category of its own. `ErrorCategories` defines the eight names; `Errors`
maps each entry to `{ code, status, message }`, and the `satisfies` keeps a new
entry from inventing a code outside the taxonomy.

## What was reclassified

| Situation | Before | Now |
| --- | --- | --- |
| Email, symbol or instrument already registered | 400 `BAD_REQUEST` | 409 `CONFLICT` |
| Ledger refusal: negative quantity, currency mismatch, position out of range | 400 `BAD_REQUEST` | 422 `DOMAIN` |
| Every other input refusal | 400 `BAD_REQUEST` | 400 `VALIDATION` |
| Session missing or invalid | 401 `UNAUTHORIZED` | 401 `AUTHENTICATION` |
| Admin route reached by a non-admin | 403 `FORBIDDEN` | 403 `AUTHORIZATION` |
| Too many requests | 429 `TOO_MANY_REQUESTS` | 429 `INFRASTRUCTURE` |
| Unforeseen failure | 500 `INTERNAL_SERVER_ERROR` | 500 `INTERNAL` |

`NOT_FOUND` is the only code that kept its name, and also the only one the web
compares against (`isNotFoundError`, in `web/src/lib/axios/errors.ts`).

## Two decisions that cannot be derived from the code

**A wrong current password on `PATCH`/`DELETE /v1/user` stays 400
`VALIDATION`.** Semantically it is a re-authentication, but the web's
interceptor treats any 401 outside sign-in and sign-up as a rejected session: it
clears the token and redirects. Answering 401 to someone who merely mistyped a
password would sign them out mid-operation. The refusal belongs to one form
field, and it is reported as a field.

**Rate limiting is `INFRASTRUCTURE`.** The TASK 18.2 taxonomy has no throttling
category; the limit is one of capacity, not of input or of permission. The
limiter answers without going through the error boundary, so the envelope and
the log line's `req.errorCode` are written in its own `handler` — which closes
the gap recorded in [`observability.md`](observability.md) during TASK 18.1.

## Where each error is produced

* Services throw the category's class; nothing outside `src/errors` constructs
  an `ApplicationError` directly.
* `ErrorHandlerMiddleware` is the only boundary that writes the
  `{ code, message, details }` envelope, converts whatever is not an
  `ApplicationError` into `INTERNAL`, and records the code in `req.errorCode`.
* `details` is filled by validation only, with one `{ path, message }` per
  refused field. In every other category it is `[]`, always present.
* No response carries a stack, SQL or driver message: see
  [`api-inventory.md`](api-inventory.md), §Response shape.
