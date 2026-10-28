# Containers

The Docker Compose development environment and the production images. It
records how to operate them and the decisions that cannot be derived from the
files.

Requires Docker Engine with the Compose v2 plugin (`docker compose`).

## Files

| File | Role |
| --- | --- |
| `compose.yaml` | Development environment and verification services. Project `ex3`, whatever the clone directory is. |
| `.env.example` → `.env` | Values `compose.yaml` interpolates. `.env` stays out of git. |
| `backend/Dockerfile`, `web/Dockerfile` | Stages `base`, `deps`, `builder`, `prod-deps`, `dev` and `runner`. |
| `backend/.dockerignore`, `web/.dockerignore` | Keep `.env*`, `node_modules` and build artifacts out of the build context. |

## First run

```sh
cp .env.example .env
# POSTGRES_PASSWORD: openssl rand -hex 24   (hex: the password goes into the connection URL unescaped)
# JWT_SECRET:        openssl rand -base64 48
docker compose up --build
```

The web is at http://localhost:3000 and the API at http://localhost:8080. Both
ports are published on `127.0.0.1` only. The development Postgres publishes no
port: reach it with
`docker compose exec postgres psql --username=ex3 --dbname=ex3`.

Without `POSTGRES_PASSWORD`, Postgres refuses to initialize the cluster;
without `JWT_SECRET`, `EnvsSchema` refuses to boot the backend. The variables do
not use `${VAR:?}` because Compose interpolates the whole file on every command,
which would require `.env` even for `pnpm test:db:up`.

The `migrate` service loads a development catalog — stocks, ETFs, a REIT and
crypto from B3, NYSE, NASDAQ and CRYPTO — so that a fresh database already
allows adding an asset and a transaction. The load inserts missing symbols
only, so running it again neither duplicates nor overwrites what an admin
corrected. Other instruments still require an administrator
(`POST /v1/instrument`), and the first one is promoted with SQL:

```sh
docker compose exec postgres psql --username=ex3 --dbname=ex3 \
  --command="UPDATE users SET \"isAdmin\" = true WHERE email = 'you@example.com';"
```

## Services

`docker compose up` starts, in this order:

1. `postgres` and `backend-deps` / `web-deps` in parallel. The `*-deps` services
   run `pnpm install --frozen-lockfile` and exit; against an up-to-date
   `node_modules` this is a check that takes seconds.
2. `migrate`, once `postgres` is healthy and `backend-deps` has finished:
   `prisma migrate deploy`, the same path production and the test suite take,
   followed by `prisma db seed`, which runs
   `src/infra/database/SeedDevelopmentCatalog.ts`. The seed stays out of the
   build and out of the production workflow.
3. `backend` (`pnpm dev`), once `migrate` has completed successfully.
4. `web` (`pnpm dev`), once `web-deps` has finished and `backend` has started.

The development services use the `dev` stage: an image with Node and pnpm, code
mounted from the host, process running as `node`. Each package's `node_modules`
lives in a volume, because the host's native binaries (`bcrypt`, Prisma, SWC)
do not serve the container's Linux. The pnpm store is a volume shared by both
packages, so that a reinstall does not download again what was already
downloaded. The `build/` of `next dev` has its own volume and does not fight
over the directory with a `pnpm build` run on the host.

`backend` has a health check on `GET /ready`, which answers for the database,
which is why `web` waits for `service_healthy` rather than for a started
container. `web` has its own on a TCP connection to port 3000: `next dev`
compiles the page that is requested, so a per-route probe would recompile on
every interval. Both probes run `node -e` inside the container, without
depending on `curl` being in the image, every 10s, with a 60s start period and
three consecutive failures to become `unhealthy`. See
[`observability.md`](observability.md).

On Linux, the container's `node` user (uid 1000) writes into the mounted code
(`dist/`, `next-env.d.ts`, `build/`). With a different uid on the host those
writes fail. On Docker Desktop for macOS the ownership mapping is transparent.

## Environment variables

The root `.env` is read by Compose only. In the container, the backend receives
`NODE_ENV`, `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`,
`API_PROXY_SECRET` and `YAHOO_FINANCE_API_KEY` from `compose.yaml`, and the web
receives `API_URL` and the same `API_PROXY_SECRET`. Because `dotenv` does not
overwrite an already defined variable, these values win over a `backend/.env`
present in the mounted code. The remaining keys (`BCRYPT_SALT`,
`JWT_EXPIRATION`, `CORS_ALLOWED_ORIGINS`) follow `backend/.env`, if it exists,
or the `EnvsSchema` default.

The web receives `API_URL=http://backend:8080`, the service name on the Compose
network. The browser only ever talks to the web.

## Checks

The `check` profile's services repeat the CI gates:

```sh
docker compose run --rm backend-check     # lint, typecheck, test:unit, test:integration, build
docker compose run --rm web-check         # lint, typecheck, build
docker compose run --rm backend-check pnpm test:unit   # a single command
docker compose rm --stop --force postgres-test   # shut the test database down
```

`backend-check` shares the network namespace of `postgres-test`. That keeps the
`localhost:5432` from `.env.test` valid inside the container, and `.env.test`
remains the single source of the suite's connection string. The service defines
no environment variable at all, because `node --env-file` does not overwrite
what is already in the environment.

**The suite does not run in the `backend` service.** There, `NODE_ENV=development`
and the development database's `DATABASE_URL` would win over `.env.test`.
`resetDatabase` refuses to truncate when `NODE_ENV` is anything but `test`
(`NonTestDatabaseResetError`), so a `docker compose run backend pnpm test`
fails without deleting data.

To run the suite on the host, `pnpm test:db:up` and `pnpm test:db:down` in
`backend/` start and remove `postgres-test` alone, published on
`127.0.0.1:5432`.

## Data and volumes

| Volume | Content |
| --- | --- |
| `postgres-data` | Development database |
| `backend-node-modules`, `web-node-modules` | Dependencies installed on the container's Linux |
| `web-dev-build` | Output of `next dev` |
| `pnpm-store` | pnpm store (`PNPM_CONFIG_STORE_DIR`) |

`docker compose down` preserves the volumes. `docker compose down --volumes`
deletes all of them, including the development database. To rebuild one
package's dependencies only, remove its volume with `docker compose down`
followed by `docker volume rm ex3_web-node-modules`. `postgres-test` uses
`tmpfs` and starts empty on every run (see [`testing.md`](testing.md)).

A change to a Dockerfile or to `packageManager` in `package.json` requires
`docker compose up --build`. A dependency change does not: `*-deps` reinstalls
on the next `up`.

## Production images

The production target is the last stage, `runner`:

- it starts from `node:24.15-alpine` without pnpm and runs as `node`, with
  `tini` as PID 1: Node does not handle SIGTERM when it is PID 1, and the
  platform that runs the image offers no `--init`;
- it carries production dependencies only, installed in a clean stage
  (`prod-deps`), plus the `builder` artifact: `dist/` and `prisma/` in the
  backend; `build/` without `build/cache`, `public/`, `next.config.js` and
  `package.json` in the web;
- it executes `node` directly, with no package manager in the process. The web
  uses `node node_modules/next/dist/bin/next start`, which keeps corepack from
  downloading pnpm when the container starts.

Corepack downloads the `packageManager` version during the build, into
`COREPACK_HOME`, readable by the `node` user of the `dev` stage. The
Dockerfiles use no BuildKit-only syntax, such as `RUN --mount`, so that any
builder can build them.

`API_URL` reaches the web as a build arg, and the `runner` stage declares it as
a container environment variable. It is read by the server at runtime, no
longer inlined into the bundle by `next.config.js` — see `security.md`,
§Secrets.
