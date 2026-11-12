# Deployment

How production runs: one host with Docker Compose, a Cloudflare Tunnel in
front and the database on Supabase. It records the topology, the one-time
setup, routine deploys and the risks this layout accepts.

**Decision (2026-11-06).** Production runs on the same VPS as development for
now. Moving it to a host of its own is recommended before anyone else keeps
data in it; see [Accepted risks](#accepted-risks).

## Topology

```text
browser ──HTTPS──▶ Cloudflare ◀──tunnel, opened from inside── cloudflared
                                                                  │ edge (internal)
                                                                web:3000
                                                                  │ api (internal)
                                                             backend:8080
                                                                  │ egress
                     Supabase (Session pooler, TLS verified) ◀────┤
                     YH Finance, brapi, Turnstile siteverify ◀────┘
```

| Network | Members | Internet |
| --- | --- | --- |
| `edge` | `cloudflared`, `web` | none (`internal: true`) |
| `api` | `web`, `backend` | none (`internal: true`) |
| `egress` | `backend`, `cloudflared` | outbound |

- No port is published on the host. Cloudflare reaches the web only through
  the connection `cloudflared` opens to it, so the host firewall, which only
  admits Tailscale, stays as it is.
- The web has no route to the internet. The browser loads Turnstile from
  Cloudflare itself, and the Next server talks only to the backend.
- The backend is reachable from the web alone, which is what
  [`security.md`](security.md#assumptions-and-operational-requirements)
  requires of `API_PROXY_SECRET` and `trust proxy`.
- Cloudflare terminates TLS. `cloudflared` is reported to append the visitor's
  address as the last `X-Forwarded-For` entry
  ([cloudflared#1426](https://github.com/cloudflare/cloudflared/issues/1426)),
  the one the web reads. That holds only once seen in production: see
  [Checks after the first deploy](#checks-after-the-first-deploy).

Every service runs with a read-only root filesystem, every capability dropped,
`no-new-privileges`, a memory and process limit, `restart: unless-stopped` and
rotated logs (`local` driver, 5 × 10 MB). Docker starts at boot, so the stack
comes back after a reboot.

| Service | Image | Health check |
| --- | --- | --- |
| `backend` | `runner` stage of `backend/Dockerfile` | `GET /ready`, which queries the database |
| `web` | `runner` stage of `web/Dockerfile`, `API_URL=http://backend:8080` | `GET /sign-in` |
| `cloudflared` | `cloudflare/cloudflared`, pinned by version and digest | `cloudflared tunnel ready` |

`web` starts once `backend` is healthy, and `cloudflared` once `web` is, so the
tunnel never forwards to a server that cannot answer.

## Files

| Where | What |
| --- | --- |
| `compose.prod.yaml` | The production stack. Project `ex3-prod`, apart from the development `ex3`. |
| `.env.production.example` | Template of the production variables. |
| `~/.config/ex3-prod/production.env` | The filled-in copy, `chmod 600`, outside any checkout. |
| `~/.config/ex3-prod/supabase-ca.crt` | Supabase's CA certificate, `chmod 644`, mounted as the `database_ca` secret. |
| `~/apps/ex3-prod` | A clone used for nothing but deploying, on a detached `master` commit. |
| `.github/workflows/migrate.yaml` | Applies the migrations to Supabase once CI passes on `master`. |

Keeping production in its own clone and its own Compose project means that
nothing done in the development checkout — switching branches, editing files,
`docker compose down --volumes` — changes what production runs. Production has
no volume of its own: its data is on Supabase.

Every command below uses this alias:

```sh
alias ex3-prod='docker compose --file ~/apps/ex3-prod/compose.prod.yaml --env-file ~/.config/ex3-prod/production.env'
```

## One-time setup

### Supabase

1. Create the project in the region closest to the VPS, with a generated
   database password.
2. Database settings › SSL Configuration: turn **Enforce SSL** on and download
   the CA certificate to `~/.config/ex3-prod/supabase-ca.crt`.
3. Connect › **Session pooler**: copy the connection string. The direct
   connection is reported to be IPv6-only; the VPS has no public IPv6 and
   GitHub's runners reportedly have none either, so both use the pooler.
   Session mode keeps a connection per client, as a long-running server
   expects.
4. Project Settings › Data API: turn it off. The app reaches the database only
   through the pooler, and the Data API would otherwise serve the `public`
   tables, where Prisma creates them, to anyone holding the project's `anon`
   key. RLS is also on in every table, with no policy: it keeps the API roles
   out and does not restrict the app, which connects as the tables' owner. A
   table a later migration adds starts without RLS, which the Security Advisor
   reports; with the Data API off, that report is not an exposure.
5. Decide on backups before real data goes in: the free plan has no automatic
   backups and pauses a project after a week without activity (see
   [Backups](#backups)).

### GitHub

In Settings › Environments › `production`, add:

- the secret `DIRECT_URL`: the Session pooler string as Supabase shows it,
  with no parameters;
- the variable `DATABASE_CA_CERT`: the contents of `supabase-ca.crt`. A CA
  certificate is public, so it is a variable, not a secret.

The migrate workflow writes the certificate to a file and appends
`sslmode=require&sslaccept=strict&sslcert=<file>`, the only parameters with
which Prisma's CLI checks the server's certificate and hostname. It ignores
libpq's `verify-full` and `sslrootcert`, and with them connects to any server.
Without the variable the workflow fails rather than migrate unverified.
Nothing else in GitHub reads the database. Requiring a reviewer on the
environment makes every production migration wait for an approval.

### Cloudflare

1. Networking › Tunnels: create a `cloudflared` tunnel named `ex3-prod` and
   copy the token from the command it shows, into `CLOUDFLARE_TUNNEL_TOKEN`.
   Do not run the command: it would start a second, unhardened connector that
   cannot resolve `web`. The wizard waits for a connector, so start only this
   one, with `DATABASE_CA_CERT` already set:
   `ex3-prod up --detach --no-deps cloudflared`. Then add a route: a published
   application on the production hostname, service **HTTP**, URL `web:3000`.
   It answers 502 until the web is up. Configure alerts, on the tunnel's page,
   reports the tunnel going down.
2. Turnstile: a widget named `ex3-prod`, mode **Managed**, without
   pre-clearance, whose only hostname is the production one; a domain would
   also admit its subdomains. Copy its site and secret keys.
3. SSL/TLS › Edge Certificates: **Always Use HTTPS** on, minimum TLS 1.2.
   Cloudflare's HSTS stays off: the web already sends the header.
4. Security rules › Rate limiting rule (not a custom rule, where Block would
   refuse everything): requests counted per IP, 100 per 10 seconds, blocked for
   10 seconds. It limits the unauthenticated traffic the API's budgets do not
   cover (TD-065). The free plan matches on the path only, so the rule is URI
   Path wildcard `/*` and covers every hostname of the domain. It counts every
   file a page loads; the threshold is a judgement, to raise if normal use is
   blocked and lower once real traffic has been observed.
5. Leave caching at its default, which keeps static files only. Never enable
   "Cache Everything": pages carry a per-response CSP nonce and the session.

### Host

```sh
install -d -m 700 ~/.config/ex3-prod ~/apps
cp ~/www/github/ex3/.env.production.example ~/.config/ex3-prod/production.env
chmod 600 ~/.config/ex3-prod/production.env
chmod 644 ~/.config/ex3-prod/supabase-ca.crt
git clone git@github.com:larahfelipe/ex3.git ~/apps/ex3-prod
```

Fill in `production.env`. `CORS_ALLOWED_ORIGINS` is the public origin, exactly
as the browser shows it, and also the hostname in the Turnstile widget.
`DATABASE_URL` is the Session pooler string with
`?sslmode=verify-full&sslrootcert=/run/secrets/database_ca` appended. The
backend's driver, `node-postgres`, then checks the server's certificate against
Supabase's CA and its hostname, and refuses to start otherwise. A password with
reserved URL characters is percent-encoded. Generate
`JWT_SECRET` and `API_PROXY_SECRET` with `openssl rand -base64 48`, never from
the development values.

## Deploying

1. Push to `master` and wait for **CI** and then **Migrate database** to pass
   for that commit. The new code must not run before its migration.
2. Build and start:

   ```sh
   cd ~/apps/ex3-prod
   git fetch origin && git switch --detach origin/master
   ex3-prod build --pull
   ex3-prod up --detach --wait
   ex3-prod ps
   ```

   `--wait` returns once every service is healthy, and fails if one is not.
   `ex3-prod logs --tail 100 backend` shows why.

The first deploy also needs the first administrator, promoted in Supabase's
SQL editor once the account exists:

```sql
UPDATE users SET "isAdmin" = true WHERE email = 'you@example.com';
```

Production starts with no instruments: each person's search, add and import
register what they hold. The development catalog (`prisma db seed`) is not
loaded.

### Rolling back

```sh
cd ~/apps/ex3-prod
git switch --detach <previous commit>
ex3-prod build && ex3-prod up --detach --wait
```

Migrations only move forward. Going back past one is safe only when the older
code works against the newer schema, so a migration that removes or renames
must ship after the code that stops using it.

## Tested before the first deploy

On 2026-11-06 the stack was built on this host (arm64) and run against a local
PostgreSQL serving TLS with a CA of its own, in place of Supabase:

- `backend` and `web` became healthy on read-only filesystems, as `node`, with
  no capabilities and `no-new-privileges`. Idle, each used about 55 MiB.
- The backend connected over TLS 1.3. With a CA that had not signed the
  server's certificate, or a hostname the certificate does not name, it refused
  to start and stayed unhealthy.
- `prisma migrate deploy` with the workflow's parameters applied the migrations
  with the right CA, and refused the wrong CA and a mismatched hostname. With
  `verify-full` and `sslrootcert` it connected despite the wrong CA.
- The web could neither reach the internet nor resolve outside names; the
  backend could. From the `edge` network the backend's name did not resolve.

Not tested: `cloudflared` with a real tunnel, Supabase's own certificate chain,
the workflow on GitHub's runners and Dependabot reading `compose.prod.yaml`.

## Checks after the first deploy

None of these could be run before the stack faced the internet:

- The production URL opens over HTTPS, and signing up succeeds. Turnstile runs
  only on submit and appears only when Cloudflare wants an interaction, so a
  successful sign-up, requests to `challenges.cloudflare.com` in the browser's
  Network tab and a solve in the widget's analytics are the evidence, with no
  `bot_challenge_unavailable` in the backend's log.
- **The visitor's address reaches the rate limiter.** After a sign-in, Supabase's
  SQL editor should show your public IP, not Cloudflare's or Docker's, at the
  end of a key:

  ```sql
  SELECT key FROM rate_limit_counters WHERE key LIKE '%address:%';
  ```

  If it shows another address, sign-in and sign-up limit everyone together:
  [`security.md`](security.md#rate-limiting) and `clientAddressHeaders` must
  change before going further.
- Response headers and the CSP reach the browser unchanged by Cloudflare
  (browser developer tools, Network tab).
- `ex3-prod logs backend` shows `database_connected`, and no
  `bot_challenge_not_enforced` or `ticker_catalog_key_missing`.

## Operating

| Task | Command |
| --- | --- |
| State and health | `ex3-prod ps` |
| Logs | `ex3-prod logs --follow --tail 200 backend` |
| Restart one service | `ex3-prod restart web` |
| Stop everything | `ex3-prod down` (production keeps no volume) |
| Use per container | `docker stats --no-stream` |

Docker restarts a service that exits, not one that turns unhealthy: a backend
that loses the database stays up, answering `503`, and shows as `unhealthy` in
`ex3-prod ps` until the database returns. Nothing alerts on it yet.

Watch for the events in
[`security.md`](security.md#monitoring-and-reassessment). The `cloudflared`
image is pinned by version and digest, and Dependabot's `docker-compose` entry
is meant to propose its updates. Whether it reads `compose.prod.yaml` shows
after its first run (Insights › Dependency graph › Dependabot); until it does,
check the `cloudflared` releases by hand. The host applies security updates by
itself (`unattended-upgrades`); a kernel update takes effect at the next
reboot.

Rotating a secret means editing `production.env` and running
`ex3-prod up --detach --wait`, which recreates the services whose variables
changed. A new `JWT_SECRET` signs everyone out. Compose does not notice a
change to the CA file or to `DATABASE_CA_CERT`: after one, run
`ex3-prod up --detach --wait --force-recreate backend`.

## Backups

**Open.** On Supabase's free plan no automatic backup exists, so a deleted
table or a broken migration cannot be undone. Before real data goes in, either:

- move to Pro, which keeps 7 days of daily backups; or
- run a nightly `pg_dump` through the Session pooler, encrypt it and copy it
  off the VPS, and restore it once to prove it works.

## Accepted risks

Running production beside development, on 2026-11-06:

- Everything on the host runs as `ubuntu`, a member of `docker` and `sudo`: the
  development servers, the packages installed for them, and agent sessions.
  Anything that compromises one of those can read `production.env` and the
  containers' environment, which hold the database password and `JWT_SECRET`.
- A development build can take CPU from production. The production services
  have memory limits; development has none.

A host of its own, with the same setup and no development tools, removes both.
