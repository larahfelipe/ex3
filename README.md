# ex3

Investment portfolio tracker: it records transactions, rebuilds each asset's
position from the ledger, and reports cost, market value, allocation and
performance in the portfolio's base currency.

Two independent packages, each with its own `package.json` and lockfile. There
is no root `package.json` and no pnpm workspace: every command runs inside
`backend/` or `web/`.

| Package | Stack | Local port |
| --- | --- | --- |
| `backend` | Node 24, Express 5, Prisma 7 over PostgreSQL 17 | 8080 |
| `web` | Next.js 16 (App Router), React 19, TanStack Query | 3000 |

## Architecture

```text
browser ──▶ web                                  ──▶ backend                      ──▶ PostgreSQL
            app/(public)    sign-in, sign-up         routes ──▶ middleware            (Prisma 7)
            app/(protected) overview, assets,               ──▶ controllers
                            account                         ──▶ services
            app/api/v1      proxy, httpOnly cookie          ──▶ domain (pure)     ──▶ YH Finance
```

The browser never talks to the backend. Every request goes through the Route
Handlers in `web/src/app/api/v1`, which read the JWT from the `httpOnly`
`ex3:token` cookie and forward it as `Authorization: Bearer`. The backend knows
nothing about cookies or browser sessions.

In the backend, each layer depends only on the one below it: `routes` declares
the HTTP contract, `services` orchestrates the use case and the database
transaction, `domain` is pure calculation, testable with no I/O (ledger,
valuation, performance, price history), and `infra` isolates Prisma, the quote
provider, cryptography and structured logging. An error is born typed in any
layer and becomes an HTTP envelope in a single error boundary.

Entry point per subject: [`docs/domain-model.md`](docs/domain-model.md) for what
the entities mean, [`docs/api-inventory.md`](docs/api-inventory.md) for the
routes and the response shape,
[`docs/authentication.md`](docs/authentication.md) for session and
authorization, [`docs/security.md`](docs/security.md) for the security
checklist.

## Requirements

| Tool | Version | Where it is pinned |
| --- | --- | --- |
| Node | 24.15 | `.node-version`, `.nvmrc`, `engines` in both `package.json` files |
| pnpm | 11.18.0 | `packageManager`; enable it with `corepack enable` |
| Docker Engine + Compose v2 | — | required for the container environment and for the integration test database |
| PostgreSQL | 17.6 | the image used by `compose.yaml` |

## Setup

### With containers

```sh
cp .env.example .env
# POSTGRES_PASSWORD: openssl rand -hex 24   (hex goes into the connection URL unescaped)
# JWT_SECRET:        openssl rand -base64 48
docker compose up --build
```

This installs the dependencies, applies the migrations and starts both packages
in development mode, with the code mounted from the host. The web is at
http://localhost:3000 and the API at http://localhost:8080, published on
`127.0.0.1` only. Services, volumes and images are detailed in
[`docs/containers.md`](docs/containers.md).

### Without containers

Requires a PostgreSQL of your own. In two terminals:

```sh
corepack enable

cd backend
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
pnpm install                  # postinstall runs prisma generate
pnpm exec prisma migrate deploy
pnpm dev
```

```sh
cd web
cp .env.example .env          # API_URL=http://localhost:8080
pnpm install
pnpm dev
```

### First run of the application

Sign-up creates the user and their first portfolio; others are created, renamed
and deleted on the portfolios screen, which is also where the active portfolio
is chosen. Under Compose, `migrate` loads a development catalog with sample
instruments, and adding an asset picks an instrument from that catalog. Without
containers, the same load is `pnpm exec prisma db seed`, after `migrate deploy`.
Other instruments are registered by an administrator only
(`POST /v1/instrument`), and the first administrator is promoted with SQL:

```sh
docker compose exec postgres psql --username=ex3 --dbname=ex3 \
  --command="UPDATE users SET \"isAdmin\" = true WHERE email = 'you@example.com';"
```

Without `YAHOO_FINANCE_API_KEY` the application still works: every quote is
reported as unavailable, and the screens show quantity and cost, with no market
value.

## Environment variables

| File | Read by | Required |
| --- | --- | --- |
| `.env` | Compose only, which interpolates it into `compose.yaml` | `POSTGRES_PASSWORD`, `JWT_SECRET` |
| `backend/.env` | the backend process, through `dotenv` | `DATABASE_URL`, `JWT_SECRET` |
| `backend/.env.test` | the test suite, through `--env-file`; it is in git and points at the test database | — |
| `web/.env` | the Next process, at build time and at runtime | `API_URL` |

`API_PROXY_SECRET`, with the same value in the backend and in the web, is
required when `NODE_ENV=production`: with it the web attests to the API the
address of whoever signs in or signs up, and throttling counts per browser
rather than per web server. In development it may be left blank on both sides.

The backend's remaining keys have defaults: `NODE_ENV=development`, `PORT=8080`,
`BCRYPT_SALT=12` (minimum 10), `JWT_EXPIRATION=1d` (a positive integer followed
by `s`, `m`, `h` or `d`, at most `30d`) and `DIRECT_URL`, which only the Prisma
CLI uses. `CORS_ALLOWED_ORIGINS` is required when `NODE_ENV=production`.

`src/config/EnvsSchema.ts` validates all of this at startup and refuses the boot
with the list of problems; a blank key, as `.env.example` distributes it, counts
as absent and receives the default.

## Database

Prisma 7 does not read the connection string from `schema.prisma`: the runtime
receives it through the driver adapter (`DATABASE_URL`) and the CLI reads it
from `prisma.config.ts`, which prefers `DIRECT_URL` — the direct connection,
with no pooler, that the migrations require.

| Command | When |
| --- | --- |
| `pnpm exec prisma migrate dev --name <name>` | create a migration from a schema change |
| `pnpm exec prisma migrate deploy` | apply the pending ones; this is what Compose, CI and production run |
| `pnpm exec prisma generate` | regenerate the client; `postinstall` already runs it |
| `pnpm exec prisma db seed` | load the development catalog; idempotent, it inserts missing symbols only |
| `docker compose exec postgres psql --username=ex3 --dbname=ex3` | open the development database, which publishes no port |

The migrations live in `backend/prisma/migrations` and are applied in production
by the `.github/workflows/migrate.yaml` workflow, once CI has passed on
`master`.

## Scripts

Backend (`cd backend`):

| Script | What it does |
| --- | --- |
| `pnpm dev` | server with reload (`tsx watch`) |
| `pnpm build` / `pnpm start` | compile to `dist/` and run the compiled output |
| `pnpm lint` / `pnpm typecheck` | ESLint with no tolerated warning; `tsc --noEmit` |
| `pnpm test` | `test:unit` and then `test:integration` |
| `pnpm test:db:up` / `pnpm test:db:down` | start and remove the test PostgreSQL |
| `pnpm prettier` / `pnpm prettier:fix` | formatting |

Web (`cd web`): `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`,
`pnpm typecheck`, `pnpm prettier`.

Both packages also expose `pnpm lint:fix`.

## Tests

```sh
cd backend
pnpm test:db:up   # postgres-test on 127.0.0.1:5432, data in tmpfs
pnpm test
```

The runner is `node:test`, with no additional framework. The unit tests
(`src/**/*.test.ts`) touch no I/O. The integration tests
(`src/**/*.integration.ts`) apply the migrations to the test database and
exercise the API over HTTP, with `supertest`, one at a time. Conventions and
limits are in [`docs/testing.md`](docs/testing.md).

`docker compose --profile check up` runs both packages' gates in a container,
the way CI does. The web has no test runner yet, and its gates are `lint`,
`typecheck` and `build` (TD-058 in [`TODO.md`](TODO.md)).

## Deployment

| Stage | Where |
| --- | --- |
| Gates for every push and PR to `master` and `develop` | `.github/workflows/ci.yaml` |
| Production migrations | `.github/workflows/migrate.yaml`, after CI passes on `master` |
| Production image | the `runner` stage of each `Dockerfile` |

The web's `API_URL` enters as a build arg and the `runner` stage declares it as
a container environment variable; the Next server reads it at runtime, and it
never reaches the client bundle. `API_PROXY_SECRET` is an environment variable
of both services in production, preferably from a secret manager and never a
build arg, because an image would keep it in its layers. The backend does not
start in production without it. The repository neither builds nor publishes an
image: building, publishing and configuring the service that runs them —
variables, `GET /ready` and `GET /health` probes — live outside it (TD-060).

## Documentation

| Document | Subject |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | layers, responsibilities and the direction of the dependencies |
| [`docs/domain-model.md`](docs/domain-model.md) | entities, ownership, values, currencies and dates |
| [`docs/financial-rules.md`](docs/financial-rules.md) | the mathematical definition of average cost, P&L, allocation and performance |
| [`docs/api-inventory.md`](docs/api-inventory.md) | routes, contracts and what changed since the baseline |
| [`docs/authentication.md`](docs/authentication.md) | session, token, cookie and authorization |
| [`docs/errors.md`](docs/errors.md) | the eight error categories and the API envelope |
| [`docs/security.md`](docs/security.md) | security checklist: inputs, secrets, headers, rate limiting and accepted risks |
| [`docs/observability.md`](docs/observability.md) | structured logging, request correlation, health and readiness |
| [`docs/testing.md`](docs/testing.md) | test infrastructure and conventions |
| [`docs/containers.md`](docs/containers.md) | Compose, volumes and production images |
| [`docs/data-fetching.md`](docs/data-fetching.md) | every browser request, hook by hook |
| [`docs/component-inventory.md`](docs/component-inventory.md) | the web's reusable components, what to keep and what to rewrite |
| [`docs/accessibility.md`](docs/accessibility.md), [`docs/responsiveness.md`](docs/responsiveness.md), [`docs/performance.md`](docs/performance.md) | normative frontend criteria |
| [`docs/toolchain.md`](docs/toolchain.md) | pinned versions and why |
| [`TODO.md`](TODO.md) | open (`TD-NNN`) and resolved technical debt |

## License

MIT. See [`LICENSE`](LICENSE).
