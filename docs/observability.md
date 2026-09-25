# Observability

How the backend reports what happened in production: what is written, with
which fields, and why none of it goes through `console`.

## Format

One line, one JSON object, with no internal break. `INFO` and `WARNING` go to
`stdout`; `ERROR` goes to `stderr`. It is the shape a log collector ingests with
no agent at all: `severity` and `timestamp` are read from the object itself, and
the rest becomes a structured payload.

```json
{"timestamp":"2026-09-19T14:32:07.123Z","severity":"INFO","event":"http_request","requestId":"b7c1d2e3-f4a5-4b6c-8d9e-0f1a2b3c4d5e","method":"GET","route":"/v1/portfolio/positions","status":200,"durationMs":37,"userId":"0f2f5a3c-2c1c-4f2a-9a1a-7c6f5d4e3b2a"}
```

| Field | Source |
| --- | --- |
| `timestamp` | ISO 8601 in UTC, taken at write time |
| `severity` | `INFO`, `WARNING` or `ERROR` |
| `event` | typed discriminator; it is what a query groups by |

`JSON.stringify` escapes `\n`, `\r` and the other control characters, so no
data coming from the request can forge a second log line. `formatLogEntry` is a
pure function and the destination is injectable (`LogSink`), which makes the
content testable without capturing `stdout`.

## Event catalog

| `event` | Severity | Own fields | Where |
| --- | --- | --- | --- |
| `server_started` | INFO | `port` | `Server.ts` |
| `database_connected` | INFO | — | `PrismaClient.ts` |
| `database_unreachable` | ERROR | `reason` | `Server.ts`, before `exit(1)` |
| `quote_provider_key_missing` | WARNING | — | `Server.ts` |
| `quote_provider_unavailable` | WARNING | `reason`, `retryInMs` | `YahooFinanceProvider.ts` |
| `quote_provider_request_failed` | WARNING | `reason` | `YahooFinanceProvider.ts`, on the sector lookup, which fails without pausing quotes |
| `dependency_unavailable` | WARNING | `dependency`, `reason` | readiness, in `HealthControllerHandlers.ts` |
| `http_request` | follows the status; a served probe produces no line | `requestId`, `method`, `route`, `status`, `durationMs`, `userId?`, `errorCode?` | `RequestLogMiddleware.ts` |
| `request_failed` | ERROR | `requestId?`, `errorName`, `errorMessage`, `stack?` | `ErrorHandlerMiddleware.ts`, for an exception outside `ApplicationError` only; an early `503`, such as an unavailable provider, was already recorded by the dependency |

`LogEvent` is a discriminated union: a new line is a new member of the type,
never a free-form message. The severity of `http_request` comes from the status
— `< 400` is `INFO`, `4xx` is `WARNING`, `5xx` is `ERROR`.

## The six fields of a request

* **request id** — `x-request-id`. An id that arrives on the request is reused
  only if it has the shape the service itself generates
  (`[A-Za-z0-9-]{8,64}`); otherwise it is replaced by a `randomUUID`. Always
  returned in the response header, so the client can correlate whatever it
  reports.
* **user id** — the id of whoever is authenticated, and nothing else. Never an
  email, never a token, never the request body: a log is read by more people
  and lives longer than the session.
* **route** — the registered pattern, not the path:
  `/v1/portfolio/positions/:symbol` groups, `/v1/portfolio/positions/AAPL`
  would not. A request that matched no route is recorded as `unmatched`.
* **status** — the code the response finished with.
* **duration** — `performance.now()` on entry and on response finish, rounded
  to milliseconds.
* **error code** — the error envelope's `code`, written into `req.errorCode` by
  the error handler (and by the 404) and read afterwards by the request log.

The log is written on the response's `finish` event, that is, after the error
boundary. That is what guarantees that `status` and `errorCode` describe what
the client actually received.

## Middleware order

`RequestLogMiddleware` is the first one registered in `App.ts`, ahead of
`helmet`. That way the id exists for any request — including the ones that die
in CORS, in the payload limit or in the rate limiter — and the `finish`
listener is already installed when any layer responds.

## Known limits

* The rate limiter answers without going through the error boundary, so the
  line's `errorCode` is written by the limiter's own `handler`: a blocked
  request goes out with `status: 429` and `errorCode: INFRASTRUCTURE`. See
  [`errors.md`](errors.md).
* Under `NODE_ENV=test` nothing is written: a suite's output belongs to the test
  runner, and a server line in the middle of it reports nothing. What the tests
  verify is the entry handed to `LogSink`, not what reached the descriptor.
* There is no distributed tracing: the service is a single process, and
  `requestId` already stitches the lines of one request together. Named metrics
  are left to the runtime platform (latency, count, instances), with no
  instrumentation of our own.

## Health and readiness

Two unauthenticated routes, outside `/v1`, answer the orchestrator:

| Route | Answers | Touches the database | Means |
| --- | --- | --- | --- |
| `GET /health` | `200 {"status":"alive"}` | no | the process is up and the event loop responds |
| `GET /ready` | `200 {"status":"ready","database":"up"}` | one `SELECT 1` per call | the instance can serve a request that reads |

They are distinct on purpose. Liveness queries no dependency because restarting
the process does not fix a database that is down: reading database
unavailability as a liveness failure would restart a healthy instance.
Readiness queries on every call — an in-memory flag would report the state the
last request happened to observe.

When the database does not answer, `/ready` goes out with 503 and the
`INFRASTRUCTURE` error envelope ([`errors.md`](errors.md)), without telling the
caller what failed; the reason goes to the log only, in the
`dependency_unavailable` event. Both routes sit behind the API's rate limit,
like any other: a probe fits comfortably within `RateLimits.API`, and a probe
that fails only because its IP blew the budget describes an instance that is in
fact not serving.

A served probe (`/health` or `/ready` with status `< 400`) produces no
`http_request` line: the orchestrator repeats the call at a fixed interval, and
each line said only that the instance was still up, which the orchestrator
already records. A failing probe is still recorded, with the status's severity
(`/ready` while down goes out as `ERROR`, beside `dependency_unavailable`). The
routes come from `ProbeRoutes`, in `Constants.ts`, the same constant that
mounts them.

In `compose.yaml`, the `backend` service's `healthcheck` calls `/ready` every
10s and `web` waits for `service_healthy`. In production there is no probe: the
configuration of the service that runs the images — where the startup probe
would point at `/ready` and the liveness probe at `/health` — lives outside the
repository (TD-060).

## How regression is prevented

`no-console` is `error` in the backend's ESLint config, with an exception for
`src/test/**` only. Any diagnostic `console.log` that escapes into production
code breaks the lint before it becomes an unstructured line in production.
