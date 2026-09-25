# Responsiveness

Layout behaviour of the frontend (`web/src`) at each validation width, used as
the criterion for TASKS 15.2 to 15.4 and for every later task that touches the
UI. Each row describes what the code does today, with the place that guarantees
it.

## Reference

| Item | Value |
| --- | --- |
| Scale | Default Tailwind CSS 4 breakpoints, with no `@theme` override |
| Validation widths | 320, 375, 768, 1024, 1440 px |
| Scope | `web/src` — `(public)` and `(protected)` routes, primitives in `components/ui` |
| Capture commit | `4363487` |
| Capture date | 2026-09-19 |

| Variant | Minimum width | Use in the project |
| --- | --- | --- |
| `max-sm` | up to 639 px | 16 occurrences — bottom bar, full-width button, `sr-only` label |
| `sm` | 640 px | 66 occurrences — the app's only structural cut |
| `md` | 768 px | no direct use; only the `@md` container variant |
| `lg` | 1024 px | two-column public layout, the dashboard's three-column grid and the asset detail's two grids |
| `xl` | 1280 px | unused since TASK 15.2 |
| `@md` | 448 px container | allocation chart orientation, in `allocation-chart.tsx` |

The product's real cut is a single one, at 640 px: below it navigation is a
bottom bar and everything stacks; above it navigation is a fixed 10 rem rail and
the content takes the rest. The `lg` and `xl` variants refine grids that are
already stacked, never the navigation.

## Layout rules

| # | Rule | Verification |
| --- | --- | --- |
| R1 | No horizontal document scrolling at any width from 320 px up | 1.4.10 · content in relative units; overflow confined to its own container |
| R2 | Overflow allowed only inside a declared region, named and keyboard reachable | 1.4.10, 2.1.1 · `components/ui/table.tsx`, a named and focusable region while it overflows |
| R3 | Touch target of at least 44 px on a coarse pointer | 2.5.8 · `min-h-11` and `max-sm:min-w-11` in `sidebar.tsx` |
| R4 | Text never truncated without an accessible alternative to the full value | 1.4.4 · `title`/`sr-only`, or a cell with the exact value |
| R5 | The screen's primary action reachable without horizontal scrolling and without leaving the flow | 2.4.3 · `max-sm:w-full` on header and state buttons |
| R6 | Live height measured in `dvh`, not `vh`, wherever the browser bar or the virtual keyboard moves | `dialog.tsx`, `alert-dialog.tsx`, `(public)/layout.tsx`, with `interactiveWidget: 'resizes-content'` in the root `viewport` |
| R7 | No fixed width greater than 320 px on a flow element | sweep of `min-w-` and literal widths |

## Behaviour by width

### 320 px and 375 px — below `sm`

| Region | Behaviour |
| --- | --- |
| Navigation | Bar fixed at the bottom, height `--navigation-bar` (3.75 rem), four 44 px targets spread across it — overview, assets, account and sign out —, `sr-only` label, brand hidden |
| Page shell | `<main>` with `pb-(--navigation-bar)` so it does not sit under the bar; the container in `(protected)/layout.tsx`, shared by every page, gives 16 px of side padding (`px-4`) and 32 px of vertical padding (`py-8`) |
| Dashboard | A single stack: portfolio value, performance chart, allocation, positions summary, recent transactions |
| Allocation | Container below 448 px: ring above, legend below, in a column |
| Positions | Filter, search and actions at full width; the table shows asset, value and the actions menu, with the result repeated under the symbol. Quantity, average cost, price, allocation and the two result columns leave the screen and remain on the asset detail, reachable through the symbol link |
| Dashboard tables | Primary columns only: the positions summary shows asset, market value and result; transactions show date, type, asset and details. Quantity, unit price and allocation leave the screen and remain available on the asset detail and in the details dialog |
| Residual scrolling | Whatever still overflows stays inside the region in `components/ui/table.tsx`, which only then is named and takes `Tab` — never the document |
| Asset detail | One column; the two `lg:grid-cols-2` grids stay stacked |
| Forms | Fields in a single column; the transaction form's `sm:grid-cols-2` does not apply |
| Dialogs | `w-full` with no side margin, square corners (`sm:rounded-lg` does not apply), 24 px of padding — 272 px of content is left at 320 px. The content is capped at `max-h-dvh` and scrolls inside: when it is taller than the screen, the dialog takes the full screen and the footer with the CTA sits at the end of the scroll |
| Virtual keyboard | `interactiveWidget: 'resizes-content'` shrinks the layout viewport, and every `dvh` with it: the dialog resizes above the keyboard and the focused field comes into the visible area |
| Authentication | The form column only; the art column is `max-lg:hidden`. `main` has `min-h-dvh`, so it grows instead of clipping when the keyboard shrinks the screen |

### 768 px — above `sm`, below `lg`

| Region | Behaviour |
| --- | --- |
| Navigation | Rail fixed on the left, `--navigation-rail` (10 rem), label visible, brand visible; `<main>` offset by `ml-(--navigation-rail)` |
| Usable width | 640 px of content, with 24 px of side padding (`sm:px-6`) |
| Dashboard | Still a single stack — the grid only splits at 1280 px |
| Allocation | Container above 448 px: past `@md`, ring and legend side by side |
| Positions | Filters in a row; the eight columns return and the table may overflow, inside the named scrollable region |
| Dialogs | Width locked at `max-w-lg` (32 rem), centred, rounded corners, height capped at `calc(100dvh - 2rem)` to leave the frame |
| Authentication | The form column only, centred: the art joins with the grid, at 1024 px |

### 1024 px — `lg`

| Region | Behaviour |
| --- | --- |
| Usable width | 752 px of content with the menu expanded and 880 px with it collapsed, with 32 px of side padding (`lg:px-8`) |
| Dashboard | Three-column grid: allocation in one, positions summary in two (`lg:col-span-2`), leaving ~490 px for the table with the menu expanded |
| Asset detail | Both grids move to two columns |
| Authentication | Screen split into two equal columns, form on the left and art on the right |
| Positions | The table normally fits with no horizontal overflow |

### 1440 px — `xl`

| Region | Behaviour |
| --- | --- |
| Usable width | 1152 px of content with the menu expanded and 1280 px with it collapsed, with 40 px of side padding (`xl:px-10`) |
| Dashboard | Same grid as 1024 px, leaving ~760 px for the summary table with the menu expanded |
| Other regions | Same as 1024 px. The page container stops growing at 1536 px (`max-w-(--breakpoint-2xl)`) and centres itself to the right of the menu, which only happens above 1824 px with the menu expanded |

## Gaps known at capture time

Observed while writing this document, each addressed in the task indicated:

| Gap | Rule | Task |
| --- | --- | --- |
| ~~The dashboard only reflows at 1280 px~~ — solved in TASK 15.2: the grid now splits at `lg` | — | 15.2 |
| ~~The positions table solves column overflow with indiscriminate horizontal scrolling~~ — solved in TASK 15.3: below `sm` only asset, value and actions, with the asset detail as the alternative | R2, R4 | 15.3 |
| ~~The scroll container in `components/ui/table.tsx` is not keyboard reachable~~ — solved in TASK 15.3 · TD-051 | R2 | 15.3 |
| ~~Between 640 px and 1024 px the authentication art column appears stacked under the form~~ — solved in TASK 15.4: the art is `max-lg:hidden` and appears only with the grid | — | 15.4 |
| ~~The public layout uses `h-screen`, not `dvh`~~ — solved in TASK 15.4 | R6 | 15.4 |
| ~~No dialog takes the full screen below `sm`, and only the transaction one caps its height~~ — solved in TASK 15.4: the cap and the scrolling live in both primitives, and the root viewport shrinks with the keyboard | R5, R6 | 15.4 |
