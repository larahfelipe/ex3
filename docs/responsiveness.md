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
| `@md` | 448 px container | allocation chart orientation, in `allocation-chart.tsx`; the finance column charts' phone layout and column gaps, in `finance-charts.tsx` |

The product's real cut is a single one, at 640 px: below it navigation is a
bottom bar and everything stacks; above it navigation is a fixed 10 rem rail and
the content takes the rest. The `lg` and `xl` variants refine grids that are
already stacked, never the navigation.

## Layout rules

| # | Rule | Verification |
| --- | --- | --- |
| R1 | No horizontal document scrolling at any width from 320 px up | 1.4.10 · content in relative units; overflow confined to its own container; a grid that stacks below a breakpoint sets `grid-cols-1`, or `min-w-0` on its items, so content that does not wrap cannot widen its single column |
| R2 | Overflow allowed only inside a declared region, named and keyboard reachable | 1.4.10, 2.1.1 · `components/ui/table.tsx`, a named and focusable region while it overflows |
| R3 | Touch target of at least 44 px on a coarse pointer | 2.5.8 · `min-h-11` and `max-sm:min-w-11` in `sidebar.tsx`; below `sm`, `--field-height` and `--control-height` (2.75 rem) in `globals.css` for every field, button and segmented control |
| R4 | Text never truncated without an accessible alternative to the full value | 1.4.4 · `title`/`sr-only`, or a cell with the exact value |
| R5 | The screen's primary action reachable without horizontal scrolling and without leaving the flow | 2.4.3 · `max-sm:w-full` on header and state buttons |
| R6 | Live height measured in `dvh`, not `vh`, wherever the browser bar or the virtual keyboard moves | `dialog.tsx`, `alert-dialog.tsx`, `(public)/layout.tsx`, with `interactiveWidget: 'resizes-content'` in the root `viewport` |
| R7 | No fixed width greater than 320 px on a flow element | sweep of `min-w-` and literal widths |

## Behaviour by width

### 320 px and 375 px — below `sm`

| Region | Behaviour |
| --- | --- |
| Navigation | Bar fixed at the bottom, height `--navigation-bar` (3.75 rem), five 44 px targets spread across it — overview, assets, portfolios, finances and account; signing out is on the account page —, its labels needing 305 px of the 312 px it has at 320 px, brand hidden — the first tab is the Overview, where the brand leads |
| Page shell | `<main>` with `pb-(--navigation-bar)` so it does not sit under the bar; the container in `(protected)/layout.tsx`, shared by every page, gives 16 px of side padding (`px-4`) and 32 px of vertical padding (`py-8`) |
| Dashboard | A single stack: portfolio value, performance chart, allocation, positions summary, recorded income, recent transactions |
| Allocation | Container below 448 px: ring above, legend below, in a column |
| Positions | Filter, search and actions at full width; the table shows asset, value and the actions menu, with the result repeated under the symbol. Quantity, average cost, price, allocation and the two result columns leave the screen and remain on the asset detail, reachable through the symbol link |
| Dashboard tables | Primary columns only: the positions summary shows asset, market value and result, with the quantity held as a secondary line under the name and the share of the portfolio under the value, so neither is lost below `sm`; transactions show date, type, asset and details, with unit price on the asset detail and in the details dialog. The recorded income's table keeps its three columns, type and two amounts, inside the table's named scrollable region should long amounts not fit |
| Residual scrolling | Whatever still overflows stays inside the region in `components/ui/table.tsx`, which only then is named and takes `Tab` — never the document |
| Asset detail | One column; the two `lg:grid-cols-2` grids stay stacked |
| Forms | Fields in a single column; the forms' `sm:grid-cols-2` does not apply. A form opens on its essential fields, and optional ones wait behind outline buttons that wrap onto as many rows as they need |
| Dialogs | A sheet along the bottom edge: `w-full` with no side margin, rounded top corners, 20 px of padding — 280 px of content is left at 320 px — sliding up on open and back down on close, 200 ms each way, while the backdrop fades with it; a dialog rendered only while open stays mounted until that exit ends (`DialogPresence`). It is at most `100dvh − 1rem` tall, so a strip of the page stays visible above it; the title and the footer with the CTA stay pinned and only the body between them scrolls, so the primary action is always in reach of the thumb. The body's single column (`grid-cols-1` in `DialogBody`) keeps to the sheet's width, so a table in it, such as a plan's installments, scrolls in its own region. The close button is a 44 px target |
| Finance overview | Every card takes the screen's width (`grid-cols-1` on the overview's grids); in Upcoming bills a description wraps onto two lines beside its amount and status, as in the other bill lists, and only past two lines is it cut short, in full on the bill it opens |
| Finance tabs | The six tabs scroll sideways in their own row, which bleeds to the screen's edges (`-mx-4 px-4`), with the baseline under every tab |
| Finance charts | Each column chart answers to its own width: under 448 px the scale's top value sits above the plot and the columns take the whole 254 px of a 320 px screen; columns sit 4 px apart, 2 px past 12 months; a month is named by its abbreviation, or by its initial where its column is under 28 px (14 px past 12 months, when every other month is named) — six months read `jan.`, twelve read `J F M…` at 320 px. The tooltip is placed against the plot and is never wider than it, so it cannot reach past the screen. Category labels wrap rather than truncate |
| Controls | Fields, select triggers, buttons and segmented controls are 44 px tall, through `--field-height` and `--control-height`, with text at 16 px in fields and 14 px in buttons; the smaller button sizes, a menu's or a list's options and the calendar's days are 40 px, and `xxs`, the inline action in a table row, 32 px. From `sm` up the same tokens return to the compact sizes: fields 40 px, buttons and toolbar fields 36 px, options 32 px, days 36 px |
| Virtual keyboard | `interactiveWidget: 'resizes-content'` shrinks the layout viewport, and every `dvh` with it: the dialog resizes above the keyboard and the focused field comes into the visible area |
| Authentication | The form column only; the art column is `max-lg:hidden`, and the wordmark heads the form, centred at the top, over the glow falling from the top edge. `main` has `min-h-dvh`, so it grows instead of clipping when the keyboard shrinks the screen |

### 768 px — above `sm`, below `lg`

| Region | Behaviour |
| --- | --- |
| Navigation | Rail sticky on the left, `--navigation-rail` (5 rem), label visible, brand visible as a link to the Overview; `<main>` beside it, in the layout's flex row |
| Usable width | 640 px of content, with 24 px of side padding (`sm:px-6`) |
| Dashboard | Still a single stack — the grid only splits at 1280 px |
| Allocation | Container above 448 px: past `@md`, ring and legend side by side |
| Positions | Filters in a row; the eight columns return and the table may overflow, inside the named scrollable region |
| Finance tabs | In Portuguese the tabs take 597 px, so beside the expanded menu they scroll in their own row below 853 px of screen, 725 px with the menu collapsed; the list is at least the row's width (`w-max min-w-full`), so its baseline runs under every tab |
| Finance charts | Past 448 px of chart, as here, the scale returns to the left of the plot, `R$ 0` at its foot, and columns sit 8 px apart, 4 px past 12 months until 576 px — the layout from before the phone one, which desktop widths keep |
| Dialogs | Centred, rounded corners, `max-w-lg` (32 rem) unless the dialog widens it (`sm:max-w-xl`, `2xl` or `3xl` for the longer forms and details), height capped at `calc(100dvh - 2rem)` to leave the frame, with the same pinned header and footer around a scrolling body; the close button is a 32 px target |
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
| ~~A dialog taller than the screen scrolls its footer, and the CTA with it, out of view, and its close button is a 32 px target below `sm`~~ — solved: below `sm` a dialog is a bottom sheet whose header and footer stay pinned around a scrolling `DialogBody`, and the close button is 44 px there | R3, R5, R6 | — |
| ~~The finance column charts scroll the page sideways below `sm`: each column's tooltip, laid out while hidden and anchored to its column, runs past the screen~~ — solved: the tooltip is placed against the plot and never wider than it, and below 448 px of chart the scale moves above the plot and the month labels shorten to fit their columns | R1, R4 | — |
| ~~The finance overview's Planned and paid and Upcoming bills cards scroll the page sideways below `xl`, and with it the bottom bar, whose last tab is cut off: their grid's implicit column, sized `auto`, grows to a bill description held on one line by `truncate`~~ — solved: the grid sets `grid-cols-1`, as do the commitment cards' grid and `DialogBody`, whose tables also widened the whole body, and the description wraps onto two lines | R1, R2 | — |
| ~~Where the finance tabs scroll, from 640 px beside the expanded menu, their baseline stops at the row's visible edge~~ — solved: the list is at least as wide as the row and as wide as its tabs | — | — |
