# Frontend performance

What was measured, what was changed and what was deliberately left as it is.
PHASE 16 measured and corrected; TASK 20.5 closed the audit; TASK 20.7 measured
in the browser, in the last section. Each one declares its capture commit. The
request audit has a document of its own, in
[`data-fetching.md`](data-fetching.md).

## PHASE 16 capture

| Item | Value |
| --- | --- |
| Capture commit | `d359afd` |
| Date | 2026-09-19 |
| Method | Static analysis of the code and a count of work per event; no browser profiler — browser measurement only appeared in TASK 20.7, in the last section |

## Charts — TASK 16.3

No chart library is installed: both charts are hand-written SVG, which already
removes the dashboard's largest source of weight and of layout work.

### Work per pointer event

`performance-chart.tsx` redid, on every `pointermove` event, the projection of
the whole series and the two `path` strings — work proportional to the number of
points, in an event that fires at the pointer's frequency. And, because the
active point's state lived in the section's component, every movement also
re-rendered the period selector and the day table.

Corrections:

| Change | Effect |
| --- | --- |
| `PerformanceSeries` became a component of its own, owner of the active index | Moving the pointer re-renders the line and the tooltip; the period selector and the table stay out |
| `useMemo` on the plotted series, on the points and on the two `path`s | The strings are built once per series, not once per event |
| `key={selectedRange}` on the component | Changing period resets the active point by remounting, with no `setState` crossing components; the table, whose state lives in the section, stays open |

### Point density

The drawing box is 600 units wide, so two points less than one unit apart fall
on the same pixel. `plottedSeriesOf` reduces the series to the step needed for
at most `MAX_PLOTTED_POINTS` (600) points, always keeping the last one — it is
the one the headline reads when the pointer is away. The `MAX` period of an old
portfolio, which would bring thousands of daily points, now draws at most 600.

The sampling applies to the drawing and to the tooltip only. The
`Performance as a table` table, which is the chart's accessible alternative,
still lists every day of the response.

### Resizing

Neither chart listens for `resize`. The performance one uses a `viewBox` with
`preserveAspectRatio="none"` and a width in CSS; the allocation one decides its
orientation by container query (`@md`), and the ring is a fixed-size SVG. The
project's only `ResizeObserver` is in `components/ui/table.tsx` and merely
toggles a boolean.

### What was not done, and why

| Item | Reason |
| --- | --- |
| Lazy loading of the charts | Both are above the dashboard's fold and load no library at all: deferring them would trade bytes that do not exist for a layout jump |
| Memoization in `allocation-chart.tsx` | The component does no work per pointer event: `selectAllocationGroups` and the ring's arcs only recompute when the response changes or when the user switches view, once per click |
| `React.memo` on the financial components | `Money`, `Percentage` and `Trend` format a value and return text; the cost of comparing props does not pay for itself against the cost of formatting |

## Tables — TASK 16.4

### Number formatters

`common/utils.ts` kept the three `Intl.DateTimeFormat` instances in module
constants, but `formatNumber` built an `Intl.NumberFormat` **per call** — and
`formatPrice` two, because `currencyFractionDigits` built another one just to
read `resolvedOptions()`. A page with 50 positions calls the formatters about
450 times per render.

Measured with Node 24, the same V8 as Chrome, over 450 formattings per round and
200 rounds:

| Strategy | Time per render |
| --- | --- |
| `new Intl.NumberFormat` per call | 12.6 ms |
| Cached formatter | 0.32 ms |

Building the formatter cost about forty times what formatting with it costs, and
on its own consumed three quarters of a 16 ms frame on every render of the
table. `numberFormatOf` now keeps the instances in a `Map` keyed by the options;
the distinct keys are bounded by the styles, the currencies and the digit counts
the formatters ask for, so the map does not grow with the volume of data. The
output is identical: same locale, same options, only the instance is reused.

### Volume

| Item | Decision |
| --- | --- |
| Pagination | Server-side in every listing: positions in 10, 25 or 50 rows, transactions in 10 on the asset detail and 5 on the Overview. The number of rendered rows does not grow with the portfolio's size |
| Virtualization | Not introduced. It solves lists whose height is unpredictable; here the ceiling is 50 rows per page, and virtualizing would cost the `<table>` semantics, the region's native scrolling and the browser's in-page search |
| `keepPreviousData` | Paginating, sorting or filtering keeps the previous page visible and dimmed, without unmounting and remounting the table body on every change |

### Rendering per keystroke

Typing in the positions search re-renders the table, because the typed text and
the listing live in the same component. With the formatters cached, what remains
per keystroke is the reconciliation of at most 50 rows, and the request only
goes out 300 ms after the last keystroke. Isolating that state in a component of
its own, as was done with the chart's active point, is only justified with a
profiler pointing at the cost — with no browser, it is not measured, and one
does not refactor in the dark.

## Bundle — TASK 16.5

The measure used throughout this section: the sum of the bytes of
`build/static/chunks`, the JavaScript the browser downloads. Next 16 no longer
prints the per-route size in `build`, and the `--webpack` in use at the time did
not generate `app-build-manifest.json`, so the comparison is of the total before
and after each change.

| Moment | Bytes |
| --- | --- |
| Before the audit (`f61b61f`) | 1,574,940 |
| After | 1,558,141 |

### Three icon libraries

The project imported icons from `react-icons` (five sets: `io5`, `md`, `lu`,
`pi`, `rx`), from `@radix-ui/react-icons` and from `lucide-react` — 11, 9 and 13
icons. `react-icons/lu` is Lucide itself repackaged, and the other two sets
delivered the same drawing with a different stroke, which made the same concept
look different depending on the screen.

Everything moved to `lucide-react`, the most used of the three. Equivalences
that are not direct renamings:

| Out | In | Note |
| --- | --- | --- |
| `CaretSortIcon` | `ChevronsUpDown` | the same arrow pair as the select's trigger |
| `DotFilledIcon` | `Circle` in `h-2 w-2 fill-current` | Lucide has no filled dot; the reduced circle is what shadcn uses |
| `RxDashboard` | `LayoutGrid` | the same four-cell grid |
| `PiEyeClosed` | `EyeClosed` | a closed eye, not the struck-through `EyeOff` |

Radix's icons draw in a 15 px box and Lucide's in a 24 px one. Every use already
fixed `h-4 w-4` or `size={n}`; the two exceptions were the select's scroll
buttons, which gained `h-4 w-4` so as not to grow.

### Removed dependencies

| Package | Importers | Installed |
| --- | --- | --- |
| `react-icons` | consolidated into `lucide-react` | 85 MB |
| `@radix-ui/react-icons` | consolidated into `lucide-react` | 4.6 MB |
| `next-themes` | none (TD-046) | 48 KB |
| `lodash.isequal` + `@types/lodash.isequal` | none | 68 KB |

That is about 90 MB less per install — what weighs most is the installation time
and the build image, not the bundle: both icon sets already entered the client
with the used icons only, which is why the chunk total drops by just 16,799
bytes.

### Service worker

`next-pwa` came with the default `runtimeCaching`, which registered 15 routes in
the worker — among them a `NetworkFirst` for `/api/`, keeping up to 16 responses
for 24 hours, and a generic `NetworkFirst` for every navigation. The
`/v1/*` API responses carry the authenticated user's positions and net worth:
they sat in the device's Cache Storage, survived sign-out, which only clears the
cookie, and could be served as current numbers when the network took more than
10 s.

The worker moved to precaching the build's output and nothing else:
`runtimeCaching: []`, `cacheStartUrl: false` and `dynamicStartUrl: false`. No
dynamic response is stored, and the installation stays valid because the
precache already installs a `fetch` handler.

| Item | Before | After |
| --- | --- | --- |
| `registerRoute` in `sw.js` | 15 | 0 |
| Precache entries | 73 | 66 |
| `login-hero.jpeg` (1.93 MB) in the precache | yes | no |

In TASK 20.3 the PWA went out entirely: with no `next-pwa` there is no worker
and no precache, and the surface described above ceases to exist. What this
section records is why it should never have existed with the plugin's default.

### What was evaluated and kept

| Item | Reason |
| --- | --- |
| `@tanstack/react-query-devtools` | Imported unconditionally in `providers/app-provider.tsx`, but the package exports a component that returns `null` outside `development`, and the panel is eliminated in the build: no reference remained in `build/static/chunks` or in `build/server`. The `Dockerfile` installs everything in the build stage and only the runtime runs with `--prod`, so the development dependency is missing nowhere |
| `next-pwa` | Kept here because installability is a product decision, not an audit one; the risk of being a plugin stalled in 2022 stayed in TD-057, and the decision came in TASK 20.3 — the PWA was removed |
| `axios` | Used in the route handlers and in the hooks, with interceptors that centralize an expired session and an API error; swapping it for `fetch` would rewrite that layer with no measured gain |
| `class-variance-authority`, `clsx`, `tailwind-merge` | The base of `cn` and of the `Button`'s variants; together they do not reach 10 KB |

The sign-in artwork is today the largest file served — 1.93 MB against 1.49 MB
for all the client JavaScript — and it is still downloaded on phones, where the
column that displays it is `hidden`. The fix touches `next/image` and the binary
file, outside this task's scope: it is in TD-056, forwarded to TASK 20.5.

## Final audit — TASK 20.5

| Item | Value |
| --- | --- |
| Capture commit | `c426c5c` |
| Date | 2026-09-20 |
| Method | local production `build` and `next start`, backend on `:8080`, a freshly created account and an empty portfolio; the median of 8 samples per route. No browser, for the reason in `accessibility.md`, §Automated audit |

| Metric | Baseline | Current | Gap |
| --- | --- | --- | --- |
| Client bundle | 1,558,141 B (TASK 16.5, webpack) | 1,580,679 B (Turbopack) | none: different bundlers, comparison below |
| Requests per page | the TASK 16.1 inventory | unchanged: 7 on the Overview, 3 on `/assets`, 4 on the detail, 1 on `/account` | two waves, because of the `portfolios` that opens the rest |
| TTFB | not measured before | 7–8 ms on the pages, 6–8 ms on the data routes | none |
| Largest file served | 2,020,657 B, downloaded on every viewport | 2,020,657 B, downloaded only at `≥ lg` | the file is still not re-encoded (TD-056) |
| LCP, CLS and INP | never measured | never measured | no browser in the environment (TD-054, TD-058) |

### Bundle

The same measure as TASK 16.5: the sum of the bytes of `build/static/chunks`.

| Moment | Bundler | Bytes |
| --- | --- | --- |
| TASK 16.5 baseline (`d359afd`) | webpack | 1,558,141 |
| This task's entry | Turbopack | 1,594,975 |
| This task's entry, same code under `--webpack` | webpack | 1,538,621 |
| This task's exit | Turbopack | 1,580,679 |

Against the direct baseline, the number would report 36,834 bytes of regression
that do not exist: TASK 20.3 returned the `build` to Turbopack when it removed
the PWA, and the baseline is a webpack build. Comparing bundler with bundler,
the code written since PHASE 16 took 19,520 bytes out of the client; Turbopack,
over that same code, emits 56,354 bytes more (+3.7%) — the price of a
`Compiled successfully` in 241 ms against 3.8 s. The largest single chunk is
427,816 bytes.

### The sign-in artwork — TD-056

`priority` is **deprecated in Next 16**, replaced by `preload`, and no longer
emits the `<link rel="preload">` the name suggests: the served HTML had no
preload at all. What the prop did was keep the eager fetch of an `<img>` the
browser downloads even under `display:none` — and the column is
`max-lg:hidden`. Every phone downloaded 1.93 MB of decoration that never
appears.

The artwork became the column's own `background-image`. The background of an
element that generates no box is not fetched, so below `lg` the request ceases
to exist; at `≥ lg` the bytes are the same, fetched after the CSS instead of
during the HTML parse. As it was the project's only use of `next/image`, the
component's runtime also left the client.

| Item | Before | After |
| --- | --- | --- |
| Request in a `< lg` viewport | 2,020,657 B | none |
| Request in a `≥ lg` viewport | 2,020,657 B | 2,020,657 B |
| `next/image` runtime in the bundle | 14,296 B | 0 |
| `/sign-in` HTML | 19,928 B | 19,392 B |

The file remains: 1.93 MB of JPEG where a WebP at the width the column uses
would settle at around a tenth of that. There is no encoder in this environment
— `sharp`, `cwebp`, `magick` and PIL absent — and the re-encoding stays open in
TD-056, now as a single item.

### Requests

The TASK 16.1 inventory ([`data-fetching.md`](data-fetching.md)) still holds: no
new query entered in phases 17 to 20, and TASK 20.2 passed every portfolio query
through `usePortfolioScopedQuery`, which suspends them until the id exists.

| Page | First wave | Second wave | Total |
| --- | --- | --- | --- |
| `/` | `currentUser`, `portfolios` | `overview`, `performance`, `allocation`, `positions`, `transactions` | 7 |
| `/assets` | `currentUser`, `portfolios` | `positions` | 3 |
| `/assets/[symbol]` | `currentUser`, `portfolios` | `position`, `transactions` | 4 |
| `/account` | `currentUser` | — | 1 |

The second wave is parallel; what delays it is the dependency on the portfolio's
id, the limit already recorded in `data-fetching.md`, §Waterfall.

### TTFB

| Page | TTFB |
| --- | --- |
| `/sign-in` | 8 ms |
| `/` | 8 ms |
| `/assets` | 7 ms |
| `/account` | 8 ms |

| Data route | Through the web's proxy | Direct to the API | Cost of the proxy |
| --- | --- | --- | --- |
| `/v1/user` | 6 ms | 3 ms | 3 ms |
| `/v1/portfolios` | 7 ms | 3 ms | 4 ms |
| `/v1/portfolio/overview` | 8 ms | 4 ms | 4 ms |
| `/v1/portfolio/positions` | 8 ms | 4 ms | 4 ms |

The hop through the proxy costs 3 to 4 ms: one more HTTP request on the same
host, plus reading the cookie and assembling the `Authorization`. It is the
price of keeping the token out of the browser, described in `security.md`,
§Session cookie.

The numbers are from `localhost`, a warm process and an empty portfolio: they
measure the path, not the database. The query cost grows with the ledger, and it
is the backend that pays it — PHASE 15 instrumented those routes. Since PHASE 16
did not measure TTFB, what is here is the baseline itself.

### LCP, CLS and INP

Not measured in this capture. LCP was measured later, in TASK 20.7, in the last
section of this document; CLS and INP still have no number. What reading the
code supports:

| Metric | What is known |
| --- | --- |
| LCP | At `≥ lg` the candidate on sign-in is the artwork, and the change above moves the moment of the fetch without changing the bytes; below `lg` the largest element becomes the sign-in card, which is text and fields. On the dashboard there is no image at all: the largest element is the net-worth card |
| CLS | Every loading state reserves an explicit height — `LoadingState` with `h-40` by default, `h-96` in the positions listing, and skeletons shaped like the content in the cards and in the charts. No image enters the flow. What no reading decides is whether the reserved height is that of the content that arrives, and it is exactly that difference that CLS measures |
| INP | The work per interaction was the target of TASKS 16.3 and 16.4: memoized chart projection, cached formatters, search with a 300 ms debounce. Without measurement, it remains an argument, not a number |

### Charts and tables — TASK 20.5

Re-verified after the refactorings of phases 17 to 20, with no regression:
`MAX_PLOTTED_POINTS` is still equal to `CHART_WIDTH`, with the step sampling that
keeps the last point; the four `useMemo`s of `performance-chart.tsx` are still
on the plotted series, on the points and on the two `path`s; the
`Intl.NumberFormat` `Map` is still in `common/utils.ts`; and the pagination is
still server-side at 10, 25 or 50 positions, 10 transactions on the asset
detail, 10 in the positions summary and 5 on the Overview.

## Browser measurement — TASK 20.7

TASK 20.5 left LCP, CLS and INP as a gap for lack of a browser. A headless
Firefox 155, driven by WebDriver BiDi, closed half of it on 2026-09-20, against
the production build served by `next start` on `localhost:3010`, with an account
seeded with one position and two purchases.

| Item | Value |
| --- | --- |
| Capture commit | `69ca10c` |
| Method | `PerformanceObserver` with `buffered: true` for LCP, `first-contentful-paint` from Paint Timing and `responseStart - requestStart` from Navigation Timing |
| Caveat | Everything on `localhost`, with no network latency and no throttling: the times are the floor of what the code can do, not the field experience |

| Route | LCP 1280×800 | LCP 390×844 | FCP | TTFB |
| --- | --- | --- | --- | --- |
| `/sign-in` with no session | 47 ms | 65 ms | 47–65 ms | 7 ms |
| `/sign-up` with no session | 50 ms | 51 ms | 50–51 ms | 9–14 ms |
| `/` | 255 ms | 225 ms | 51 ms | 9–12 ms |
| `/assets` | 216 ms | 194 ms | 51–52 ms | 9–14 ms |
| `/assets/PETR4` | 220 ms | 188 ms | 51–52 ms | 9–13 ms |
| `/account` | 39 ms | 86 ms | 39–86 ms | 9 ms |

The LCP budget is 2.5 s; the worst route sits at a tenth of that. The distance
between FCP and LCP on the protected routes — about 170 ms — is the interval
between the skeleton and the API's data, exactly the waterfall of TD-055. The
LCP element is the net-worth card's metric list on the screens with data and the
form's paragraph on the rest; the sign-in artwork is not a candidate at any
width since TASK 20.5.

What still has no number: **CLS**, because Firefox does not implement the
`layout-shift` entry type — only Chromium exposes it — and **INP**, which
requires a real interaction in an active window, which the headless harness
never has. Both remain in TD-054, alongside Lighthouse.

## App code with no side effects — 2026-09-24

`web/package.json` declares `"sideEffects": ["*.css"]`. Without the declaration,
the bundler treats every app module as capable of an effect when imported and
cannot discard what a barrel re-exports without use:
`import { Button } from '@/components/ui'`, in the root layout's provider,
carried `Calendar` — and with it `react-day-picker` — to every route, along with
the Radix components the route does not use. Sign-in downloaded the calendar
without having any date at all.

The declaration holds because the only import made for its effect alone is
`globals.css`, which the default covers. The modules with a top-level effect,
`lib/axios/axios.ts` (interceptors) and `lib/dates.ts` (`dayjs.extend`), are
reached only through their own exports: no file imports `dayjs` or `axios`
directly to use what they configure.

The measure: the sum of the bytes of the chunks the route loads at the outset —
the `rootMainFiles` of `build/build-manifest.json` plus the `entryJSFiles` of
the route's `page_client-reference-manifest.js` — in the production build
(Turbopack). It is finer than the sum of `build/static/chunks` of the previous
tasks, which does not change when code merely moves between chunks.

| Route | Before | After | Difference |
| --- | --- | --- | --- |
| `/sign-in` | 1,368,590 | 1,164,783 | −203,807 (−14.9%) |
| `/sign-up` | 1,373,727 | 1,170,942 | −202,785 |
| `/account` | 1,382,891 | 1,180,051 | −202,840 |
| `/portfolios` | 1,388,436 | 1,227,937 | −160,499 |
| `/` | 1,429,595 | 1,418,351 | −11,244 |
| `/assets/[symbol]` | 1,424,343 | 1,413,114 | −11,229 |
| `/assets` | 1,422,138 | 1,429,069 | +6,931 |
| Sum of `build/static/chunks` | 1,739,931 | 1,706,746 | −33,185 |

The routes with the transaction form keep the calendar, which they use. The
6,931 extra bytes on `/assets` are chunk regrouping by Turbopack, not new code.

**Evaluated and not done: loading the dialogs on demand (`next/dynamic`).** On
the routes that open the transaction form, the calendar and the form add up to
about 100 KB. Deferring that code takes bytes out of the load and puts them into
the first click on "New transaction" or "Edit", the main interaction of those
screens, and the dialog would open empty until the chunk arrived. With no INP
measurement in a browser (TD-054), the trade is not justified.

## Animated tabs — 2026-09-24

`framer-motion` came in for the slide of `SegmentedControl` and of the
`SlideTransition` panels ([`toolchain.md`](toolchain.md)). Three choices keep
the cost in the routes that animate:

* **`framer-motion`, not `motion/react`.** The latter re-exports the former
  through `import * as fm`, which Turbopack does not prune: with it, sign-up
  went from 1,171,069 to 1,324,882 bytes (+153,813).
* **`MotionScope` in each primitive, not in the root provider.** With
  `LazyMotion` and `MotionConfig` in the layout's provider, sign-in and account,
  which animate nothing, carried 37 KB more (sign-in at 1,201,977). Inside the
  primitives, they grow by 344 bytes, the feature bundle's `import()`.
* **Features through `import()`.** `domMax`, 88,176 raw bytes and 28,437 with
  gzip, arrives in a separate chunk when the first primitive mounts, not on the
  route's load. The first render's content does not depend on it: panel and
  indicator render with `initial={false}` and the CSS fills in the marked item
  until the radio is read.

The same measure as the previous section, in the production build:

| Route | Before | After | Difference |
| --- | --- | --- | --- |
| `/sign-in` | 1,164,910 | 1,165,254 | +344 |
| `/sign-up` | 1,171,069 | 1,229,960 | +58,891 |
| `/account` | 1,180,178 | 1,180,522 | +344 |
| `/portfolios` | 1,229,036 | 1,281,696 | +52,660 |
| `/` | 1,419,295 | 1,478,387 | +59,092 |
| `/assets` | 1,430,013 | 1,482,673 | +52,660 |
| `/assets/[symbol]` | 1,414,058 | 1,466,718 | +52,660 |

**Evaluated and not done.** The other microinteractions already exist in CSS and
gain nothing by changing library: a dialog and an alert enter and leave with a
fade and a 95% scale, a popover, a menu and the `Select`'s list with a fade and
a zoom, the button shrinks on touch, and `APPEAR_CLASS` gives the fade to what
replaces a load. The performance chart's period only slides the indicator: the
panel does not change, the new data arrives afterwards, over the dimmed previous
one, and sliding it would show the old chart leaving for the same chart to come
back. An animated height for a field's error was discarded because the error
appears and disappears while typing, and the form would shake on every
keystroke. The asset detail's window chips are metric cards, not tabs.

None of this was verified in a browser in that session.
