# Toolchain

Record of the pinned versions and of the decisions that cannot be deduced from
`package.json`.

## Versions

| Item | backend | web |
| --- | --- | --- |
| Node | 24.15 (`.nvmrc`, `.node-version`, `engines`, the Dockerfiles' base image) | same |
| pnpm | 11.18.0 (`packageManager`) | same |
| TypeScript | 6.0.3 (`~6.0.3`) | same |
| Prettier | 3.9.10 | 3.9.10 |
| ESLint | 10.13.0 | 10.13.0 |
| `typescript-eslint` | 8.72.1 | 8.72.1 |
| `eslint-config-prettier` | 10.1.8 | 10.1.8 |
| `eslint-plugin-prettier` | 5.5.7 | 5.5.7 |
| `eslint-plugin-perfectionist` | 5.13.0 | 5.13.0 |
| `@next/eslint-plugin-next` | — | 16.4.3 |
| `eslint-plugin-react` | — | 7.37.5 |
| `eslint-plugin-react-hooks` | — | 7.1.1 |
| `eslint-plugin-jsx-a11y` | — | 6.10.2 |

Everything above is on the latest stable, with one deliberate exception:
`typescript`, held on the 6.0 line by a tilde range.

The web's i18n library, `use-intl` 4.14.9, and `intl-messageformat` 11.2.15,
the version it bundles, which the catalog test parses with, are pinned exactly
so that the two stay the same; [`i18n.md`](i18n.md#library) explains both.

## Why TypeScript 6.0 and not 7.0

`typescript@7.0.2` is the native compiler distribution and **no longer
publishes the compiler's JavaScript API**: the package's `exports` exposes only
`./package.json`, `.` (which resolves to `lib/version.cjs`, an object with
`version` and `versionMajorMinor`) and a `./unstable/*` set. There is no
`typescript/lib/typescript.js` any more.

The repository's whole toolchain at the time depended on that API:

* `next@14` — `verifyTypeScriptSetup` calls
  `require(deps.resolved.get('typescript'))`; resolution fails, `require`
  receives `undefined` and the process dies with `TypeError: Cannot read
  properties of undefined (reading 'endsWith')`. That takes `next lint` down.
  In `next build` the effect is worse because it is silent: `tsconfig.json` is
  never read, the `paths` disappear and webpack fails with
  `Can't resolve '@/common/constants'` — the build breaks for a reason with no
  apparent relation to the cause;
* `@typescript-eslint@7` — `require('typescript')` returns the version object
  and the plugin blows up while loading the rules. With the lint target fixed
  (baseline failure 29), `pnpm lint` in the backend started failing with exit
  code 2.

Both packages therefore stay on the latest stable line that keeps the JS API:
**6.0.3**, which still ships `lib/typescript.js`. It needed no change to either
`tsconfig.json`. The range is `~6.0.3`, not a caret, because
`typescript-eslint@8.72.1` declares `typescript >=4.8.4 <6.1.0` as a peer: a
6.1 release would satisfy `^6.0.3` and fall outside what the linter supports.

Migrating to 7.x remains blocked for the same reason. Re-evaluate once
`typescript-eslint` and Next.js declare support for the native package. Nothing
in the source depends on 7.x-specific syntax — the switch is one of
dependencies, not of code.

## Consequent adjustments

* **The backend's lint target.** `eslint --max-warnings=0` passed no target at
  all, and ESLint 8 does not assume `.` by default: the command exited 0 without
  analysing a single file (baseline failure 29). In ESLint 10 the default is
  `.`, and the script started actually linting — 111 files.
* **`eslint-plugin-prettier` 4 → 5 and `eslint-config-prettier` 8 → 10 in the
  backend.** The old pair uses `prettier.resolveConfig.sync`, removed in
  Prettier 3 (`TypeError: prettier.resolveConfig.sync is not a function`). The
  web was already on the 5.x line.
* **The backend's `prettier:fix`** ran `--check` alongside `--write`.
* **The backend's build chain.** `tscpaths@0.0.9` (unmaintained since 2019,
  requires `baseUrl`) was replaced by `tsc-alias`; `ts-node-dev` +
  `tsconfig-paths` by `tsx`. `tsconfig.json` declares `paths` without `baseUrl`,
  and `tsconfig.build.json` excludes the test files from the published artifact.

## ESLint: flat config (TASK 2.2)

Both packages moved to `eslint.config.mjs` and the `.eslintrc.json` files were
removed. `pnpm lint` calls ESLint directly (`eslint --max-warnings=0`), without
`next lint`: linting stopped depending on the Next lifecycle and became an
independent pipeline step.

ESLint 9 was discarded: the line is in `maintenance` and the package itself
declares `deprecated` ("This version is no longer supported"). The installed
version is 10.

### Decisions in the web

* **Rule set composed explicitly** from `typescript-eslint`,
  `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`
  and `@next/eslint-plugin-next`, instead of `eslint-config-next`. The rules the
  project used were preserved one by one. Out went `eslint-config-next@14.0.4`
  (out of step with the installed `next@14.2.24`) and `eslint-plugin-next@0.0.0`
  (an empty placeholder, baseline failure 6).
* **`@next/eslint-plugin-next` on 16.3.4, not on the installed Next's 14.2.24.**
  The 14.x calls `context.getCwd()`, removed in ESLint 10, and the lint dies
  while loading `@next/next/no-html-link-for-pages`. The plugin is a set of
  static rules, independent of the runtime; TASK 2.3 aligns Next with that
  version.
* **`settings.react.version` is read from `react/package.json`** by
  `eslint.config.mjs` itself. The value `'detect'` makes `eslint-plugin-react`
  call `context.getFilename()`, also removed in ESLint 10. Reading the installed
  version avoids pinning a number that would go stale in TASK 2.4.
* **`jsx-a11y/anchor-has-content` and `jsx-a11y/heading-has-content` turned off
  in `src/components/ui/**`.** The primitives forward `children` through props;
  the content the rules look for exists only at the call site. It is a limit of
  static analysis, not an absence of accessible content.
* **Configuration files at the root** (`next.config.js`, `postcss.config.js`,
  `tailwind.config.ts`, `eslint.config.mjs`) got a block of their own with Node
  globals and `@typescript-eslint/no-require-imports` turned off.

### Type-checked rules and import order (2026-10-29)

Both packages lint with `typescript-eslint`'s `recommendedTypeChecked` over
the project's `tsconfig.json` (`projectService`), plus
`no-floating-promises` — with the `node:test` calls, which the runner awaits,
as safe — `no-misused-promises` and `switch-exhaustiveness-check`, which takes
a `default` as covering a union. The web also takes `eslint-plugin-react-hooks`'
`recommended-latest` set, the React Compiler's rules included, in place of the
two rules it listed by hand. In the backend the type-aware set raised about 740
findings, fixed in the code rather than silenced:

* **`ControllerRequest`** in `interfaces/Controller.ts` types a request's body
  as `unknown`, since nothing a request carries is trusted before a schema
  parses it. Every controller takes it; `fieldsOf` in `validation/Validator.ts`
  spreads a body into the object a schema validates together with the route's
  parameters.
* **`ApplicationError` extends `Error`**, so a rejection carries a stack and
  `instanceof Error` holds; the error middleware still picks `code`, `message`
  and `details` explicitly, and the response is unchanged.
* **`require-await` is off** in the backend: an `async` method that satisfies a
  promise-returning contract turns a throw into a rejection, and its callers
  rely on that.
* **The tests' `no-unsafe-*` rules are off** in `*.test.ts`,
  `*.integration.ts` and `src/test/**`: `supertest` hands a response body over
  as `any`, and the assertions are what check its shape. Source files keep
  them.

`eslint-plugin-perfectionist` replaced `eslint-plugin-import-helpers` in both
packages. It sorts the imports in groups — Node built-ins and packages
together, then `@/`, then relative paths, a blank line between groups — and
the named imports and exports and the export statements alphabetically,
values before types. It applies with `--fix`, and nothing else in the plugin is
turned on: sorting object keys
or JSX props would reorder code whose order carries meaning.

### Violations fixed

The current `recommended` sets are stricter than those of ESLint 8 /
`@typescript-eslint` 6 and pointed at five real problems, all fixed rather than
silenced:

| File | Rule | Fix |
| --- | --- | --- |
| `web/src/app/api/v1/assets/types.ts` | `@typescript-eslint/no-empty-object-type` | `interface ... extends WithMessage {}` → `type ... = WithMessage` |
| `web/src/hooks/use-disclosure.ts` | `@typescript-eslint/no-unused-expressions` | ternary with a side effect → `if/else` |
| `web/src/app/(protected)/assets/_components/assets-table.tsx` | `no-useless-assignment` | `{++i}` → `{i + 1}` |
| `web/next.config.js` | obsolete `eslint-disable` directive | `@typescript-eslint/no-var-requires` was renamed to `no-require-imports` |
| `backend/src/**` | — | import reordering in the test files (`import-helpers/order-imports`), which had never been linted |

## Dependency migration (TASKS 2.3 to 2.7)

Every runtime dependency of both packages was taken to the latest stable. The
breaking changes that required a code change are below; what only changed
number is not recorded.

| Dependency | From | To |
| --- | --- | --- |
| `express` | 4.18.3 | 5.2.1 |
| `zod` | 3.22.4 | 4.6.2 |
| `prisma` / `@prisma/client` | 5.10.2 | 7.10.0 |
| `bcrypt` | 5.1.1 | 6.0.0 |
| `dotenv` | 16.4.5 | 17.4.2 |
| `next` | 14.2.24 | 16.3.4 |
| `react` / `react-dom` | 18.x | 19.3.0 |
| `tailwindcss` | 3.3 | 4.3.3 |
| `lucide-react` | 0.336 | 1.44.0 |

### Backend

* **Express 5.** `@types/express@5` no longer re-exports the types from
  `express-serve-static-core`, which `src/types/express.d.ts` augments to
  declare `Request.user`. The package became a direct dependency
  (`@types/express-serve-static-core@^5`), otherwise the augmentation resolves
  against another copy of the types and `req.user` ceases to exist. With the
  typing correct, the routers' `authMiddleware as Application` casts — which
  existed only to silence the error — were removed. `async` handlers that reject
  now propagate to the error middleware without `try/catch`, but
  `errorHandlerMiddleware` remains the single error boundary and does not depend
  on that.
* **Zod 4.** The format validators left the `z.string()` namespace and became
  top-level functions (`z.email()` in place of `z.string().email()`);
  `ZodError.errors` became `ZodError.issues`; `required_error`/
  `invalid_type_error` became the single `error` key; `ctx.addIssue` requires an
  explicit `code: 'custom'`. `validate` in `src/validation/Validator.ts` and
  `EnvsSchema` were adjusted.
* **Prisma 7.** An architectural change, not just a version one:
  * the `datasource` in `schema.prisma` no longer reads `env("DATABASE_URL")`.
    The CLI's URL moved to `prisma.config.ts` (which loads `dotenv` on its own)
    and the runtime's to the driver adapter;
  * `@prisma/adapter-pg` is now mandatory —
    `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`;
  * with an adapter, `$connect()` only assembles the pool and **resolves even
    with the database unreachable**. The connectivity check at startup was a
    silent no-op; it now runs `SELECT 1`. That was a latent defect, not a
    consequence of the upgrade — 5.x already behaved that way under an adapter;
  * `prisma migrate`/`generate` read `DIRECT_URL` when present, so as not to
    migrate through the pooler;
  * the "migration works" criterion was only closed in TASK 3.1:
    `prisma/migrations` was in `.gitignore`, so there was no migration to apply.
    See [`testing.md`](testing.md).
* **bcrypt 6.** No API change; it requires Node >= 18 and recompiles the native
  binding, hence `bcrypt: true` in `allowBuilds`.
* **dotenv 17.** It started printing a promotional banner on every `config()`.
  Silenced with `config({ quiet: true })`, which also keeps the tests' output
  clean.

### Web

* **Next 16.**
  * `middleware.ts` was renamed to `proxy.ts` and the `middleware` export to
    `proxy` (`ProxyConfig` in place of `MiddlewareConfig`). The old file still
    works with a deprecation warning; the new name was adopted.
    [`authentication.md`](authentication.md) follows suit;
  * Turbopack is the default bundler, and `next-pwa@5.6.0` (the latest stable)
    is a webpack plugin: it injects `config.plugins` through `webpack()`, which
    Turbopack ignores, and the service worker is never generated. The
    alternative that is maintained (`@serwist/next`) has the same limitation, so
    switching plugins would not solve it. The PWA was removed in TASK 20.3 as a
    product decision: `dev` and `build` went back to running under Turbopack,
    without `--webpack`. That closes baseline failure 28 — there is no
    incompatible plugin left to contain;
  * `cookies()` has been asynchronous since Next 15 — the route handlers that
    use it now `await`;
  * Next 16's `dev` writes `AGENTS.md` and `CLAUDE.md` at the package root on
    every run, with rules generated by the framework itself. They are
    unversioned files that compete with the repository's documentation: turned
    off with `agentRules: false` in `next.config.js`.
* **React 19.** `@types/react@19` moves `JSX` inside the `React` namespace and
  removes the global: references to `JSX.Element` now either import
  `type JSX` from `react` or qualify as `React.JSX.Element`. Turning `ref` into
  an ordinary prop required no change during the upgrade — the primitives used
  `React.forwardRef`, which is still supported. In the 2026-09-22 modernization
  they started receiving `ref` as an ordinary prop, typed by
  `React.ComponentProps`, with neither `forwardRef` nor `displayName`.
* **Zod 4 in the web.** `z.string().trim().email()`, deprecated, became
  `z.string().trim().pipe(z.email())`. `z.email().trim()` does not do: it
  validates the format before trimming and would refuse an email with
  surrounding spaces, which the previous schema accepted.
* **Tailwind 4.** Configuration in CSS, not in JS:
  * `tailwind.config.ts` was removed. Theme and keyframes live in
    `src/app/globals.css` through `@theme` and `@custom-variant`;
  * `@tailwind base/components/utilities` became `@import 'tailwindcss'`;
  * the PostCSS plugin changed from `tailwindcss` to `@tailwindcss/postcss`,
    which already applies prefixes — `autoprefixer` is gone;
  * `tailwindcss-animate` is not compatible with the CSS configuration;
    replaced by `tw-animate-css`;
  * the default border colour became `currentcolor`. A compatibility block in
    `globals.css` preserves the 3.x appearance.

### Infrastructure

* **`pnpm-workspace.yaml` in both Dockerfiles.** pnpm 11 reads `allowBuilds` and
  `minimumReleaseAgeExclude` from that file; without copying it into the image,
  the build's `pnpm install` failed in the backend (`bcrypt`/Prisma build
  scripts blocked). Another latent defect: the file came into existence in TASK
  2.1 and the Dockerfiles were never updated.
* **`minimumReleaseAgeExclude`.** pnpm's supply-chain policy rejects versions
  published recently. The ones the repository needs are listed explicitly by
  exact version (`zod@4.6.2`, `lucide-react@1.44.0`), never by package — a
  wildcard per package would accept any future release.

### Defect fixed along the way

`web/src/app/api/v1/assets/route.ts` assembled the backend URL discarding the
query params it had received: pagination and filters never reached the API. The
request now forwards `req.nextUrl.searchParams`.

## Dependency update — 2026-10-29

Both packages were taken to the latest stable within the ranges above; both
`pnpm audit`s report no known vulnerability and both lockfiles install with
`--frozen-lockfile`. The major releases, none of which needed a code change
beyond what the lint asked for:

| Dependency | From | To |
| --- | --- | --- |
| `typescript` (both) | 5.9.3 | 6.0.3 |
| `dotenv` (backend) | 17.4.2 | 18.0.9 |
| `@hookform/resolvers` (web) | 5.9.1 | 6.0.2 |
| `framer-motion` (web) | 13.4.2 | 14.7.1 |

`@hookform/resolvers@6` brings `ajv@8`, whose `fast-uri` sat on a release
with a published advisory (fixed in 3.1.9). The web now pins it through
`overrides: fast-uri: ^3.1.9` in its `pnpm-workspace.yaml`, as the backend
does for its own transitive advisories below. Neither package needs a
`minimumReleaseAgeExclude` entry any more.

## Dependency audit — TASK 20.3

`pnpm audit` answers **"No known vulnerabilities found"** in both packages.
Before this task there were 7 advisories in `backend` (4 high, 3 moderate) and
46 in `web` (31 high, 10 moderate, 5 low), all transitive: no direct dependency
was vulnerable.

### Main runtime versions

| backend | | web | |
| --- | --- | --- | --- |
| `express` | 5.2.1 | `next` | 16.3.4 |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 7.10.0 | `react`, `react-dom` | 19.3.0 |
| `zod` | 4.6.2 | `@tanstack/react-query` | 5.102.8 |
| `bcrypt` | 6.0.0 | `react-hook-form` | 7.87.0 |
| `jsonwebtoken` | 9.0.3 | `@hookform/resolvers` | 5.9.1 |
| `helmet` | 8.3.0 | `zod` | 4.6.2 |
| `express-rate-limit` | 8.7.0 | `axios` | 1.20.0 |
| `cors` | 2.8.6 | `tailwindcss` | 4.3.3 |
| `dotenv` | 17.4.2 | `lucide-react` | 1.44.0 |

### `overrides` as a fix for a transitive advisory

A transitive advisory is not fixed by updating the direct package: whoever
brings it in is out of date, and sometimes unmaintained. pnpm 11 reads
`overrides` from `pnpm-workspace.yaml`, no longer from `package.json`, and the
backend's `Dockerfile` already copies that file before the `install` — the image
gets the same pins. Only `backend` needs pins; `web` cleared its advisories by
removing `next-pwa`, and what is left of the tree already resolves to fixed
versions within the ranges its parents declare.

| Package | Pinned at | Arrives through | Failure fixed |
| --- | --- | --- | --- |
| `braces`, `micromatch`, `picomatch` | `^3.0.3`, `^4.0.8`, `^2.3.2` | `tsc-alias` → `chokidar`/`globby` | ReDoS |
| `deepmerge-ts` | `^8.0.2` | `prisma` → `@prisma/config` | prototype pollution |
| `mysql2` | `^3.23.1` | `prisma` (a driver this project does not use) | decompression bomb |
| `postcss` | `^8.5.28` (a direct dependency, updated) | — | arbitrary file read and path traversal in the source map |

The web's 46 advisories all came from `next-pwa@5.6.0`, unmaintained since 2022,
which drags in a whole build chain (`workbox-build`, `babel-loader`,
`clean-webpack-plugin`) and holds `webpack`, `lodash`, `rollup@2` and
`@babel/core` at 2022 versions. They were build advisories, not runtime ones:
none of that chain was served to the browser. With the plugin removed, `web`
started auditing clean without a single `overrides` — `ajv@6`/`ajv@8`,
`minimatch@3` and `brace-expansion@1`, left over under `eslint` and
`@hookform/resolvers`, already resolve to fixed versions.

### Removed dependencies

`next-pwa` went out with the whole PWA — `public/manifest.json`, the layout's
`<link rel="manifest">`, the `withPWA` in `next.config.js` and the two
`.gitignore` lines that hid the generated worker. The application is no longer
installable and precaches nothing; what is gained is a 2022 build chain out of
the tree and Turbopack back in `dev` and `build`. Reintroducing installability
depends on a plugin that supports Turbopack.

`@radix-ui/react-checkbox`, `@radix-ui/react-separator` and
`@radix-ui/react-tooltip` went out with the three primitives that were their
only consumers (`components/ui/checkbox.tsx`, `separator.tsx` and
`tooltip.tsx`), none of them rendered by any screen. Tree shaking already kept
them out of the bundle; what goes away is trust in three publishers on every
`install`. Reintroducing them is a `pnpm add` and the shadcn file.

The rest of the manifest has a verified consumer, including the cases a search
for `import` does not reach: `@types/*` (ambient types), `tsc-alias` (the
`build` script), `eslint-config-prettier` (a peer of
`eslint-plugin-prettier/recommended`), and `dotenv` (`config/Envs.ts` and
`prisma.config.ts`).

### Known peer divergence

`pnpm peers check` reports `eslint-plugin-jsx-a11y@6.10.2` and
`eslint-plugin-react@7.37.5` declaring `eslint` up to 9, with 10.10.0
installed (10.13.0 since the 2026-10-29 update). The rules load and `pnpm lint` passes with `--max-warnings=0` in both
packages; it is a lag in the plugins' declarations, not an observed
incompatibility.

## `framer-motion` — 2026-09-24

A new dependency, required to animate the tabs: the slide of the
`SegmentedControl` indicator and of the `SlideTransition` panels needs layout
animation between elements and an exit animation for an unmounted element,
which CSS and `tw-animate-css` do not do. Pinned to an exact version, `13.4.2`,
the most recent one outside pnpm's `minimumReleaseAge` window on the day it was
installed; `14.7.1` since the 2026-10-29 update.

The `motion` package, the library's current name, did not get in:
`motion/react` re-exports the whole of `framer-motion` through `import * as`,
and Turbopack does not prune a re-exported namespace. Importing from
`framer-motion`, with `LazyMotion` and `m`, sign-up took 58 KB raw more instead
of 154 KB ([`performance.md`](performance.md), "Animated tabs"). The rest of the
app keeps animating through CSS: dialogs, popovers, menus and the buttons'
press already have entrance and exit through `tw-animate-css` over Radix's
presence. Since 2026-11-13 `AnimatePresence` also keeps a dialog that its
parent stops rendering mounted until that CSS exit ends (`DialogPresence`); it
animates nothing itself, so no feature bundle loads for it.

Since 2026-11-11 the `SegmentedControl` indicator slides by a CSS transition,
measured within the control, and no longer uses the library; framer-motion
serves `SlideTransition` alone, with `domAnimation` in place of `domMax`
([`performance.md`](performance.md), "Tab indicator by CSS").
