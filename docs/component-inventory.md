# Reusable component inventory

A classification of the frontend (`web/src`) at commit `8dc9edd`, to decide what
to keep ahead of PHASES 8–13. 4,481 lines of TS/TSX.

## UI primitives — `src/components/ui`

shadcn/ui over Radix, with `cn()` (`clsx` + `tailwind-merge`) and
`class-variance-authority`. A solid base, kept.

| Component | Base | Assessment |
| --- | --- | --- |
| `button` | Radix Slot + CVA | **Keep.** The variants already cover the new product. `outline` has a transparent background, like the fields, and inherits the surface it sits on. A press shrinks the button to 98% under `motion-safe:`, like the side menu's items, and confirms the click |
| `card` | — | **Keep.** The base of PHASE 8's KPI cards. `CardTitle` and `CardDescription` went out in the 2026-09-22 UX audit: every section title comes from `SectionHeader`, with an `<h2>`. Elevation in three levels: the page background, the card (`bg-surface`, a border and `shadow-surface`, a shadow barely perceptible outside the light theme, where surface and background are the same white and the border is what cuts the card out) and the overlays (`bg-surface-elevated` and `shadow-elevated`: dialog, popover, menu and the `Select` list). The card has `rounded-2xl`, the same as the dialog from `sm` up, and containers inside it `rounded-xl`; the padding is 20 px on a phone and 24 px from `sm` up. No screen overrides the card's elevation, and no card reacts to the pointer, because none is clickable as a whole: the interaction lives in the buttons, links and table rows inside it |
| `dialog`, `alert-dialog` | Radix | **Keep.** The focus trap and `aria` come from Radix. Since TASK 15.4 the content is capped at `max-h-dvh` and scrolls inside — below `sm` that amounts to the whole screen — and the footer separates the stacked buttons with `gap-2`. `DialogFooter` carries an edge-to-edge divider above the actions (`border-t` over `-mx-6`, which cancels the content's `p-6`, and `pt-4`, which mirrors the `gap-4` above it), with the `--border` token in both themes; that is why it is always a direct child of `DialogContent`. `AlertDialogFooter` goes without a divider: the confirmation is short, and the line would only separate one sentence from the buttons. The two share `DIALOG_OVERLAY_CLASS` and `DIALOG_CONTENT_CLASS`, from `dialog.tsx`: the content sits on the elevated surface, like menu, select and popover, because it is the screen's topmost layer; it enters and leaves in place, with a fade and a 95% scale, over 200 ms decelerating on open and 150 ms accelerating on close, with no slide — the animation's `transform` adds to the `translate` that centres the content, and the old slide made it come in diagonally. The overlay darkens to 60% and blurs the page behind it (`backdrop-blur-sm`); under `prefers-reduced-transparency`, the `reduced-transparency` variant in `globals.css`, it goes back to 80% and no blur |
| `dropdown-menu`, `select` | Radix | **Keep.** Reduced in the 2026-09-22 UX audit to the parts with a consumer: `DropdownMenu`, `Trigger`, `Content`, `Item` and `Separator`, which the positions table's menu brought back to isolate deletion; `Select`, `Trigger`, `Value`, `Content` and `Item`, with the scroll buttons `SelectContent` itself uses. `SelectTrigger` follows `Input`: transparent background, `--input` border and `aria-invalid:border-negative`; the placeholder sits in `--muted-foreground` through `data-placeholder:`, since `placeholder:` does not apply to a button |
| `input`, `label` | Radix | **Keep.** `checkbox` was removed with `@radix-ui/react-checkbox` in the dependency audit (TASK 20.3): it had had no consumer since the assets table stopped selecting rows. `Input` and the notes textarea have a transparent background, which inherits the card's or the dialog's surface, 16 px text below `md` — iOS zooms the page in when a field with a smaller font is focused — and 14 px from there up. The icon on the left takes no click, which reaches the field; the show-password button is a 32 px square inset 4 px from the border, instead of covering it on hover |
| `popover`, `calendar` | Radix, react-day-picker 10 | **New.** `Popover` over `@radix-ui/react-popover`, with `dropdown-menu`'s elevated-surface tokens. `Calendar` is shadcn/ui's over `DayPicker`, with the project's classes on the elements v10 names (the same as v9), `lucide-react` arrows and days as `ghost` buttons |
| `segmented-control` | — | **New.** `SegmentedControl`/`SegmentedControlItem` styles a group of native `input[type=radio]` as a segmented control — no ARIA role of its own beyond what HTML already gives a radio. The checked item uses `--primary`/`--primary-foreground`, and hover only darkens the text of the unchecked item (`peer-not-checked:hover:`): `hover:text-foreground` comes after `peer-checked:` in the sheet, with the same specificity, and used to swap the checked item's text for the foreground colour over `--primary`; the container gets `border-negative` when the `ChoiceField` around it is invalid (`in-data-invalid:`). The checked item's background is a single indicator, shared by the control's items (`layoutId` in a `LayoutGroup` keyed by the control's `useId`, so that two controls on the same screen do not swap indicators), which slides to the chosen option on a 300 ms spring with a slight bounce (`TAB_SPRING`), while the text changes colour over the same time. The control reads the checked radio from the DOM, through `useSyncExternalStore` over the group's `change`, and not from props: the radio registered with react-hook-form is uncontrolled, a click only fires `change` on the radio that became checked, and `reset` checks another with no event at all. Until that read, on the server and in the first render, the background comes from CSS (`peer-checked:bg-primary`), and hydration does not flash. Five consumers: the transaction type (`transaction-form-dialog.tsx`), the portfolio's base currency (`portfolio-form-dialog.tsx`) and sign-up's (`sign-up-form.tsx`), registered in the form, and, controlled, the allocation view (`allocation-chart.tsx`) and the performance period (`performance-chart.tsx`) |
| `table` | Semantic HTML | **Keep as a primitive**, but it covers neither sorting, selection nor an empty state — the consumer implements it all. Since TASK 15.3 the wrapper is a `section` that requires the `label` prop: while it overflows, it becomes a named, focusable region; `regionClassName` adjusts the box that scrolls. `TableRowHeader` is each row's first cell, a `th scope="row"` styled like `TableCell`, so that the screen reader announces the asset, the group or the date while moving across the columns. Every table has an `sr-only` `TableCaption` with what it lists |
| `pagination` | — | **Removed** in the 2026-09-22 UX audit: it never had a consumer, and every listing paginates with buttons, not with links |
| `skeleton` | — | **Keep.** It becomes the base of `LoadingState` (TASK 12.4) |
| `separator`, `tooltip` | Radix | **Removed** in TASK 20.3, with `@radix-ui/react-separator` and `@radix-ui/react-tooltip`: no screen rendered them |
| `sonner` | Sonner | **Keep** |

**Missing and needed:** `tabs`, `sheet` (mobile nav, TASK 13.2), `badge`,
`chart`. No charting library is installed — a decision pending for TASK 8.3.

## Layout components

| Component | Assessment |
| --- | --- |
| `components/sidebar.tsx` | **Redesigned.** A single `nav[aria-label="Main"]`, which switches from a fixed bottom bar (< `sm`) to a fixed rail on the left (≥ `sm`), collapsible to icons only from `lg` up — below that there is no horizontal room for a narrow rail and the compact label next to the icon. Two sections: `PORTFOLIO_SECTIONS` (Overview, Assets, Portfolios, in an unlabelled list, separated from the account by the border and by the space down to the rail's footer) and `ACCOUNT_SECTION` (Account, with the user's name as `detail` when expanded, and Sign out below it, outside the route — it disappears below `sm`, where the bar is navigation only and the account is reached through the Account item itself). The active item comes from `usePathname`, in sub-routes too (`isCurrentPath`), with `aria-current="page"`, a side indicator (`bg-primary`) and a highlighted icon only when expanded. The collapsed/expanded state is read from the `APP_STORAGE_KEYS.Navigation` cookie in the server component (`(protected)/layout.tsx`, through `cookies()`) and passed as `initialState`: the first render already comes out in the right state, with no flash. The toggle is a 24 px circle over the rail's right border, centred on the brand's line, with a chevron pointing where the rail is going — left when expanded, turning right when collapsed — and a 44 px target through a pseudo-element; on hover, the rail's border lights up with it (`has-[>button:hover]`). For it to be able to cross the border, `nav` does not scroll: the content scrolls in an inner container, which is `contents` in the bottom bar. `aria-label` and `title` are dynamic ("Collapse navigation"/"Expand navigation"); it writes the cookie on every switch (`max-age` of one year) and only appears at `lg`; the `navigation-expanded:` class (a `data-navigation-state` variant in `globals.css`) conditions the label, the indicator and the active item's background, without duplicating the layout between the two modes. Every colour comes from a token (`--primary`, `--accent`, `--muted-foreground`, `--negative` on Sign out); no fixed colour |
| `app/(protected)/layout.tsx` | **Keep** as the shell: skip link, `Sidebar` and `<main>`. The container inside `<main>` gives every page its padding — 16, 24, 32 and 40 px on the sides at the base, at `sm`, `lg` and `xl`, and 32 px vertically — and stops at 1536 px, centred; each page only stacks its sections with `space-y-6` |
| `app/(public)/layout.tsx` | **Keep.** Form on the left and artwork on the right from `lg` up. The layout gives both screens a single column of up to 400 px, with no footer, centred vertically and horizontally in the form's area (the whole screen below `lg`, the left half from there up) through automatic margins. When the column does not fit in the height, the margins drop to zero and the page scrolls, without cutting the top off. A height change, such as a validation error, an API notice or a sign-up step change, re-centres the column, and the brand and the title move half the difference; it enters with a fade and 8 px of rise over 500 ms; the artwork blends into the background through a 96 px gradient on the inner edge. `_components/public-page-header.tsx` is the header of both: the brand in `font-display`, a hairline in a `--primary` gradient that picks up the artwork's lights, and the screen's `<h1>` in emphasis, with no description. `_components/auth-notice.tsx` is the notice of both, with an icon, in the `warning` tone (session expired) or `negative` (an API error, `role="alert"`). `_components/auth-alternative.tsx` closes both with the question and the link to the other screen, underlined in `--muted-foreground` turning to `--foreground` on hover. `_components/session-cache-disposal.tsx` discards the React Query cache when the layout mounts, after the protected screens have unmounted |
| `app/layout.tsx` | **Keep** — fonts, theme, providers |

**Missing:** `PageHeader`, `SectionHeader` (TASK 12.3), mobile navigation (TASK
13.2).

**The Server ↔ Client boundary (TASK 16.2).** `'use client'` marks what needs
state, an effect, context or an event — and nothing beyond that. Client: the
providers, the navigation (`usePathname`), the three screens that read data
through hooks, the two authentication forms and the primitives that wrap Radix
or hold state, such as `table.tsx` since its scrollable region observes its own
box. Server: `app/layout.tsx`, the two group layouts, the sign-in and sign-up
pages — which render only the static frame around the client form — and every
Route Handler in `app/api/v1`. A component with no interaction that is used only
inside a client component stays in the client graph, and marking it changes
nothing: the boundary is defined by whoever renders it.

## Feature components — `app/(protected)/(overview)/_components`

The Overview is the main page, at `/`. The permanent redirect from `/` to
`/assets` went out of `next.config.js`; sign-in, sign-up and authenticated
access to a public route all lead to `/`. A browser that cached the old 308
keeps going to `/assets` until its cache is cleared. The page reads the active
portfolio and shows the name and the base currency in the header, with a
loading state, an error with a retry and a missing portfolio.

| Component | Responsibility |
| --- | --- |
| `(overview)/page.tsx` | The header, with "Add asset", and the composition of the sections: portfolio value, performance, allocation beside the positions on wide screens, and recent transactions. Adding an asset — from the header or from the positions' empty state — opens `AssetDialogs` on the Overview itself |
| `portfolio-value-card.tsx` | `PortfolioValueCard`, over `QuerySection`, with `GET /v1/portfolio/overview` in a definition list: the total value in emphasis, the day's change, the invested value and the profit or loss, with a percentage, and the quotes' time (`quotedAt`) in a `<time>`. Empty when the portfolio has no position with units (`heldPositionCount` `0`). Staleness comes from `QuerySection`'s notice. A fallback quote from the provider shows up only through the older time. "Refresh", in the header, is `RefreshPortfolioButton` |
| `allocation-chart.tsx` | `AllocationChart`, over `QuerySection`, with `GET /v1/portfolio/allocation`: a selector by asset (`byAsset`, the initial view and the first option) or by class (`byType`) in a `SegmentedControl` in the header, a decorative SVG ring (`aria-hidden`) and a legend in a table, the textual alternative, with colour, name, percentage and value in the base currency. Groups from the largest percentage to the smallest, and the ring starts with the largest; a group with no `allocation` stays out of the ring, goes to the end in the API's order and shows as "Not available". Ring and legend side by side when the card is at least 28rem wide (a container query), stacked below that. The colours come from the `--chart-1` to `--chart-10` tokens by rank; from the 11th group on they all use the neutral `--muted-foreground`, a single band at the end of the ring, so that no colour repeats between two groups (TD-025, resolved). Switching the view slides ring and legend through `SlideTransition` in the direction of the chosen option — Class sits to the right of Asset, so the class view comes in from the right — and the card follows the new legend's height |
| `positions-summary.tsx` | Positions in a table, 10 per page, with the page in `positionsPage` in the URL and the previous page shown while the next one loads; the symbol leads to the asset detail; with no positions, it opens the Overview's own add-asset dialog |
| `recent-transactions.tsx` | The 5 most recent transactions in `TransactionsTable`: the listing's first page, which sorts by `executedAt` descending |

## Shared components — `src/components`

| Component | Responsibility |
| --- | --- |
| `amounts.tsx` | `Amount`, `SignedAmount` and `UnavailableValue`: a missing value shows as `-` and is read as "Not available" |
| `load-error-alert.tsx` | `LoadErrorAlert`, the error with a retry (`role="alert"`), used by the sections and by the pages of the Overview, the assets screen and the asset detail |
| `query-section.tsx` | `QuerySection` frames a section in a card with an `h2` title and resolves, from the query, the loading (`aria-busy`), error-with-retry, empty and content states; cached data stays on display if the new fetch fails, below the `StaleState` with a retry (`isRefetchError`). The error with a retry is the shared `LoadErrorAlert`. When the displayed content changes — another page of data or the empty state — and the focus, which was in the section or in a dialog opened from it, falls to `body`, focus goes to the `<h2>`, which `SectionHeader` makes focusable by script (`tabIndex={-1}`). The content enters with `APPEAR_CLASS` when it replaces loading or empty; a new page and a refetch do not repeat the fade, because the container stays mounted |
| `refresh-portfolio-button.tsx` | `RefreshPortfolioButton`, the "Refresh" of the portfolio value, on the Overview, and of the positions. It invalidates the portfolio's whole scope through `useRefreshPortfolio`, so that no number on screen comes from a newer quote than the others, with `cancelRefetch: false`: it joins the fetches already running instead of restarting them. It stays `aria-disabled`, with the icon spinning, until every fetch has finished, and ignores clicks until then, so a repeated click produces no request. A failure shows up in the section that failed, through `QuerySection`'s `StaleState` or `ErrorState`. The backend keeps each quote for 60 s, so the button takes no more than one fetch per minute per instrument to the provider |
| `page-navigation.tsx` | `PageNavigation`, the `nav` of "Previous", position and "Next" of the four paginated listings — positions on the Overview and on the assets screen, an asset's transactions and portfolios — with the position in `aria-live="polite"` and an optional `detail`, the position count on the assets screen. The buttons at the ends use `aria-disabled`, not `disabled`, so that reaching the first or the last page does not take focus away from the button |
| `submit-button.tsx` | `SubmitButton`, the submit of every form, with a spinner while sending. While pending, it goes `aria-disabled` and cancels its own click, which also cancels the implicit submission by Enter in a field; `disabled` would take focus away from the button and leave it on `body` when the submission fails. `disabled` remains for unavailability that does not come from sending, such as an edit with no change |
| `toaster.tsx` | `Toaster`, the app's `sonner`, in the bottom right corner. It draws in the `APP_THEME` theme (`common/constants.ts`), the same class `app/layout.tsx` puts on `<html>`, with the colours of the elevated-surface tokens, so it follows the application's theme. `sonner`'s CSS comes in without a layer and after the app's, so the classes that override it carry the `!` modifier: without it, the 22 px icon, the top alignment and the shadow did not show. Each toast has a close button in the top right corner, with a focus ring in `--focus`, like the action. The only border in the status tone is the bottom one, and it counts the time: a 3 px bar in the tone — `--positive`, `--negative`, `--warning`, `--info` — empties over a track of the same tone at 25% during the toast's life, in `globals.css`, in place of the neutral bottom border. A `loading` toast, which has no deadline, keeps the neutral border. The animation lasts `--toast-lifetime`, which `toastLifetimeOf` (`lib/toast-lifetime.ts`) writes alongside the `duration`, and pauses whenever `sonner` holds the timer — the list expanded by the pointer or by the shortcut (`data-expanded`), pressed (`:active`) or the document hidden (`data-document-hidden`, set by the `Toaster`, which resolves the style on the spot because a hidden document does not render). Under `prefers-reduced-motion`, it keeps its duration, like the spinner, because it says how long the toast stays. A toast leaving by swipe hands the animation back to `sonner` |
| `motion-scope.tsx` | `MotionScope`, the `LazyMotion` (`strict`) and the `MotionConfig reducedMotion="user"` around each animated primitive, rather than around the app: a route that does not animate downloads nothing from framer-motion, and the feature bundle (`lib/motion-features.ts`) arrives through `import()` the first time a primitive mounts. `strict` refuses the full `motion`, which would bring the features along with the component. Under `prefers-reduced-motion`, transform and layout do not animate; opacity does |
| `slide-transition.tsx` | `SlideTransition`, the tabs' panel change: the incoming panel slides in the direction of `direction` (`1` from the right, `-1` from the left) on the `TAB_SPRING` spring and the outgoing one slides the opposite way, the two overlaid (`AnimatePresence mode="popLayout"`). The outgoing one goes `inert` — neither focus nor the screen reader reaches content that is on its way out. The container's height is measured by a `ResizeObserver` and animated with no bounce, with no transition under `prefers-reduced-motion`; the clip (`overflow-hidden`) has 6 px of slack on each side (`-m-1.5`/`p-1.5`), so that the fields' focus ring is not cut off. Two consumers: `AllocationChart` and `SignUpForm` |
| `info-note.tsx` | `InfoNote`, the auxiliary note: text in `--muted-foreground` with the `Info` icon aligned to the first line. It is for the rule or the consequence one reads before acting, without the weight of a warning: the single portfolio that cannot be deleted, in the footer of the portfolio list, and the sign-out a password change causes, next to the button. Errors and warnings stay in a box with a border and a tone, like `AuthNotice` |
| `info-tip.tsx` | `InfoTip`, a 24 px button with the `Info` icon that opens a `Popover` with the explanation, labelled `About …` on the button and in the content. It opens by click, touch or keyboard, not by hover, because a hover tooltip does not appear on a touch screen. It serves a term or a figure the label does not explain: the time-weighted return in `PerformanceChart` and the `yield on cost` in the asset detail, the latter through `Metric`'s `info` prop. It does not repeat what is already written on screen |
| `performance-chart.tsx` | `PerformanceChart`, over `QuerySection`, with `GET /v1/portfolio/performance`, of the whole portfolio on the Overview and of one position, by `symbol`, on the asset detail: a period selector in native radio buttons in the header, from `1W` to `MAX`, kept in `range` in the URL, with the previous period shown while the new one loads; the selector only appears when there is something to filter — a series in the period, or, if it came back empty, in the whole history (`MAX`), requested in that case only — and stays when a period fails, so another can be chosen; a decorative SVG line (`aria-hidden`) from `SeriesChart`, with an area under it, and the whole series in a table inside a `<details>`, the textual alternative, with day, value, invested, net contribution and return. The pointer moves the marker, the chart's reading of day, value and return, and the header's. With no pointer, the header reads the last point. No value is computed in the web: the numbers become coordinates only in order to draw, and every displayed value is formatted from the API's decimal string. The series' day is formatted in UTC, the zone it closes in. `1D` stays out of the selector (TD-032). While the new period loads, the previous one is dimmed (`opacity-60`) and `aria-busy`, like the positions table. Next to the header's percentage, an `InfoTip` says that it is a time-weighted return and why it differs from the result: money put in or taken out counts as neither gain nor loss |
| `series-chart.tsx` | `SeriesChart`, the decorative SVG line (`aria-hidden`) of a series of decimal strings, with an area under it in the given tone — `primary`, `positive` or `negative` — an optional dashed baseline and, under the pointer, the vertical guide, the marker and the reading the caller assembles, on the elevated surface and on the side opposite the point so as not to leave the card. The index under the pointer belongs to the caller, which also reads it outside the drawing; touch marks the point, a horizontal drag traverses the series (`touch-pan-y`) and a vertical one scrolls the page. The numbers become coordinates only in order to draw, and the paths are only rebuilt when the series changes. It serves `PerformanceChart` and the asset detail's price chart |
| `date-picker.tsx` | `DatePicker`, shadcn/ui's date selector: a button with the chosen day, or "Pick a date", which opens the `Calendar` in a `Popover`, with month and year in lists (`captionLayout="dropdown"`, from 100 years back to the end of the current year, v10's default). The lists are the design system's `Select`, not the native `<select>`, whose open list the browser draws in its own colours, outside the theme: `Calendar` swaps `MonthsDropdown` and `YearsDropdown` and navigates through the DayPicker context's `goToMonth` from the displayed month, which is why it shows one month at a time (`numberOfMonths` only accepts 1); the month appears abbreviated, so that both lists fit between the previous- and next-month buttons. The DayPicker's `nav` stretches across the title's line, over both lists, and does not take the pointer (`pointer-events-none`), only the arrows do: a click anywhere on the month or the year, on the text or on the icon, opens the list, which lights up on hover along with the icon. Opening a list inside the calendar does not close it, and Esc closes the list only. It keeps the day as `YYYY-MM-DD`; choosing closes the calendar and returns focus to the button, and choosing the same day again does not unselect it (`required`). The label names the button in place of its content, so the displayed day also describes it (`aria-describedby`), and the screen reader announces the chosen date. Opening the calendar takes focus to the chosen day, as in the APG's date dialog |
| `money-input.tsx` | `MoneyInput`, the amount field where digits enter from the right, as on a cash register: 1, 2, 5 and 0 read 12.50, deleting gives the last digit back, and a typed dot or comma changes nothing, because the comma is implicit and no locale convention is guessed. It displays the value grouped in the app's locale (`formatDecimal`), aligned to the left, right after the currency symbol, and with tabular figures, while the form keeps the decimal string the API receives. The places come from `decimals`; a stored or pasted value with more places keeps them, up to the column's 18, and clearing the field goes back to the field's places. Pasting reads the whole value through `readDecimal`, with either convention and without the surrounding currency symbol or code; an ambiguous or unreadable paste leaves the field unchanged and becomes an error on it. `inputMode="numeric"`, up to 20 integer digits |
| `transactions-table.tsx` | `TransactionsTable` lists the transactions it receives, with an optional asset column, omitted on the asset detail. The execution day in the browser's zone, with no time, the same one the form records it in. Each row has a "Details" button, whose accessible name includes type, asset and date, which opens `TransactionDetailsDialog`. Editing and deleting start from that dialog and open `TransactionFormDialog` or `ConfirmDeletionDialog` on top of it: cancelling goes back to the detail, and finishing closes both. The write invalidates the portfolio through `useRefreshPortfolio`, and transactions, position, indicators and performance are fetched again |
| `transaction-details-dialog.tsx` | `TransactionDetailsDialog` shows the whole transaction in a dialog, while the web has no detail screen: type and asset in the title, execution date in the description, and quantity, unit price, fees, taxes, broker and notes in a definition list, with the price label depending on the type. A missing broker and notes show as "Not available"; no total is computed in the web. The footer has "Delete", "Close" and "Edit" |
| `transaction-form-dialog.tsx` | `TransactionFormDialog` creates or edits a transaction: creation starts from the asset detail and from the row menu in the positions table, always in the context of an asset, and editing starts from the details dialog. The form is assembled on every opening. In two columns from `sm` up, in a dialog wider than the others (`max-w-xl`): the type at full width, price and quantity side by side, with the label rows at the height of the `xxs` action so that both fields start at the same height with or without "Use 100 held", and the day at full width. Type in native radio buttons — buy, sell, income and bonus — in three columns on a phone, with a hint that says the chosen type's effect on the position and what to fill in; quantity as text with a decimal keypad, which starts at 1 on creation and discards a typed or pasted minus sign, followed by buttons that subtract and add one whole unit and preserve the fraction, for every class (`shiftByWholeUnits`), with an accessible name ("Decrease quantity by 1"), `aria-controls` on the field and `aria-disabled` instead of `disabled`, so that focus does not fall off the button, when the result would not be positive or the text is not a number (empty counts as zero); on creation, for a sale and income, which count units already held, and with the position holding some, "Use 100 held" beside the label fills in the held quantity and returns focus to the field; unit price, fees and taxes in a `MoneyInput`, with the price label depending on the type (unit price, the income's value per unit or the bonus's attributed cost), with the currency code in the label and its symbol inside the amount field, the portfolio's base on creation and the transaction's on edit; on creation, the unit price starts at the position's market price, in the base currency, rounded to the field's places (exact if rounding would zero it), with the hint "Market price as of" and the quote's time while the value is that one, and it follows the type while nobody changes it: it stays for buy and sell and empties for income and bonus, whose value per unit is not the market one; with no market price, or with the position in another currency, the field starts empty; execution day in a `DatePicker`, with no time, in the browser's zone, the day the dialog opens on creation, sent as the instant `instantOfCalendarDay` anchors to it, and the API's error about `executedAt` shows on the day; fees, taxes, broker and notes are details: the form opens with type, quantity, price and day only, and an "Optional details" group offers one button per missing detail ("Add fees", with "Add" for the screen reader only), which reveals the field and focuses it; each revealed detail has "Remove" beside its label (accessible name "Remove fees"), which discards the value and returns focus to the button that brings it back. On edit, the details with a value open already revealed — a fee or tax other than zero, a broker or notes present — and choosing JCP reveals the taxes, because JCP is paid net of withheld tax. The dialog reads the position (`usePosition`) before assembling the form, with a skeleton while it loads, because the instrument's class defines the unit price's places: the currency's or `UNIT_PRICE_DECIMALS`'s (8 for crypto and funds), whichever is greater; fees and taxes use the currency's. Without the position, the form opens with the currency's places. It validates with the API's limits: the quantity is read by `readDecimal` (`lib/decimal.ts`), with a dot or comma decimal separator, because the decimal keypad in pt-BR offers the comma alone, and with a thousands separator from either convention when both appear or the same one repeats between groups of three; a comma before exactly three digits, such as `1,500`, is refused as ambiguous, with both readings in the message; up to 20 integer digits and 18 places, quantity and price greater than zero, a price of zero accepted for a bonus only, blank or removed fees and taxes as zero, a broker up to 60 and notes up to 500 characters, blank as `null`. On edit, a date that was not changed keeps the stored one, milliseconds included, so as not to change the ledger's order. The primary button names what the creation records, depending on the type ("Add buy", "Add sell", "Add dividend", "Add JCP", "Add interest", "Add bonus"), and "Save changes" on edit. While sending, fields and buttons are disabled and the dialog does not close; the API's error shows on the field the detail's `path` indicates or, with no corresponding field, in an alert, and what was typed stays in the form |
| `confirm-deletion-dialog.tsx` | `ConfirmDeletionDialog`, the confirmation of every deletion — asset, portfolio and transaction — in an `AlertDialog` with a title, the consequence, "Cancel" and the destructive confirm named after the action. It stays open until the deletion finishes: while it runs, "Cancel", `Esc` and a click outside do not close it, and the confirm goes `aria-disabled` with a spinner, without losing focus. The API's refusal, such as deleting a `BUY` a `SELL` depends on, or the last portfolio, shows in an alert in the dialog itself, with no toast. With `confirmationPhrase`, which only portfolio deletion passes, the dialog asks for the name to be typed: focus opens in the field, labelled "Type <name> to confirm" with the name in `whitespace-pre-wrap` so that repeated spaces show, with neither autocorrect nor autocomplete; the confirm stays `aria-disabled` until the text matches the name exactly, compared in NFC so that a decomposed accent does not look like a divergence; `Enter` in the field or on the confirm before that marks the field invalid with "This does not match the name above" and returns focus to it; during the deletion, the field is `readOnly`. The caller closes the dialog after deleting and takes focus to a destination that is still on screen, since the row that opened it is gone |
| `add-asset-dialog.tsx` | `AddAssetDialog`. A single search view, with no list before the user types. What is typed or pasted becomes upper case in the field itself, with the cursor kept in place; a composition in progress (an accent, an IME) is only converted once it finishes. Search by name does not distinguish case, and the API also upper-cases the symbol (`AssetSymbolSchema`). The term, validated by the same pattern as the API's, goes to `GET /v1/instruments/search` 500 ms after the last keystroke, or immediately on Enter, and the response becomes a list of native radios with the instruments the user already sees, with the "Private" badge on their own, and what the quote provider lists under the term as a ticker, with the "New" badge, market and currency. Name, class and sector are not asked for: choosing a listing sends only `symbol` and `listing { market, currency }`, and the API records the rest from the provider. A single result is chosen on its own once the search settles, so Enter searches and a second Enter adds. The state is announced (`role="status"`): searching, how many were found, and no results with the hint to search by ticker; an unavailable provider warns that the new instruments are missing, with a retry. A search failure, `429` included, shows an error with a retry; a failure to add stays in the dialog (`role="alert"`), with the `409` for an already visible instrument translated into the asset already existing in the portfolio, with no toast. Adding resolves `onConfirm`'s promise, and whoever hosts the dialog closes it |
| `asset-dialogs.tsx` | `AssetDialogs`, the asset dialog open on a screen — add asset, new transaction, in `TransactionFormDialog`, or delete asset, in `ConfirmDeletionDialog` — one at a time, described by `AssetDialog`, a union discriminated by `kind` that the screen keeps in `useState` and swaps through `onDialogChange`. No dialog is opened from the URL: with both the URL and the state saying whether the dialog was open, the closing `replaceState` reached `useSearchParams` after the render that closed it, and the effect that read `action` reopened it, so "Cancel" only closed on the second click. Adding an asset closes the dialog as soon as the API confirms, and the "Asset added" toast offers "Add transaction", which opens the asset's new transaction on the same screen, without navigating. Used by the assets screen and by the Overview |
| `detail-item.tsx` | `DetailItem`, the term and value of a definition list, used by the transaction dialog and by the asset detail |

## Feature components — `app/(protected)/assets/[symbol]`

The asset detail, at `/assets/[symbol]`, opens from the symbol in the Overview's
positions and in the positions table. No value is computed in the web.

| Component | Responsibility |
| --- | --- |
| `[symbol]/page.tsx` | A server page that forwards the route's symbol to `AssetDetail` |
| `asset-detail.tsx` | `AssetDetail` reads the active portfolio, `GET /v1/portfolio/positions/:symbol` through `usePosition` and, in parallel, `GET /v1/portfolio/positions/:symbol/indicators` through `usePositionIndicators` and `GET /v1/portfolio/positions/:symbol/fundamentals` through `usePositionFundamentals`. A header with a way back to the assets screen, the symbol in an `h1`, the name and the "Add transaction" button, with the `Plus` icon like the action buttons in the assets and portfolios headers, which opens `TransactionFormDialog` in the portfolio's base currency. At full width, **Market**, in the quote's currency: the price in emphasis, the day's change and the previous close, the quote's time in a `<time>`; below it, the change over `1M`, `3M`, `6M`, `YTD` and `1Y` in cells with `Trend`, which are native radio buttons in the "Price change" group and choose the window of the price chart right below, at full width: a `SeriesChart` with the daily closes from `closes` starting at the window's `openedOn`, the opening dashed, the colour from the change's sign, the reading of day and close under the pointer, and the first and last day in the legend, which the screen reader reads with both closes. It opens on the longest window, `1Y` when the history reaches it; a window with no change is disabled, and with none at all the chart shows every close, with no selection. It is a line, not candles, because the history keeps one close per day, with no session open, high and low. Beside the windows on wide screens, and below the chart on narrow ones, the 52-week range in a bar with the last close marked between the low and the high; then the legend with that close and its day; finally the profile, with the class and only the market, currency and sector the asset has. With no close in the last year, the price block disappears; while loading, the skeletons of the windows and of the chart; on error, the message with a retry, without hiding the quote. Below, side by side on wide screens, **Position**, in the base currency, with the market value in emphasis, the unrealized result with a percentage, the quantity, the average cost, the price and the allocation, and **Returns**, over `QuerySection`, in the ledger's currency: the realized result in emphasis, the income received, the last 12 months' income, the `yield on cost`, whose computation an `InfoTip` beside the label explains, and the day of the first transaction. The income follows the class: interest for bonds and Treasury, income for stocks, ETFs, funds and REITs, and, for crypto, cash and other, only when the ledger recorded it. With no transaction, Returns says it starts at the first one. Next, **Fundamentals** (`asset-fundamentals.tsx`), the position's performance and the asset's transactions. Loading, an error with a retry for the portfolio and for the position, a missing portfolio and an asset outside the portfolio, with a shortcut to the assets screen; a missing value shows as "Not available". The range bar converts the price into a number only to place the marker; every displayed value comes from the decimal string. The highlights use `HEADLINE_VALUE_CLASS` and `PROMINENT_VALUE_CLASS` from `components/financial.tsx`, the same as the portfolio value on the overview |
| `asset-fundamentals.tsx` | `FundamentalsSection`, over `QuerySection`, shows the position's fundamentals in two columns of `Metric`s, four on wide screens, in order and with only the metrics the asset's class has (see Fundamentals in [`financial-rules.md`](financial-rules.md)), each label with an `InfoTip` saying what the metric measures and how to read it. A multiple with two places and `×`; a share as a `Percentage`; growth as a `Trend`, with a sign and a tone; free cash flow compact, in the statements' currency. A metric the source does not report shows as "Not reported", and the note below the grid attributes the numbers to the source, which another one may compute differently. A class with no fundamentals and an asset the source does not know use an `EmptyState`, each with its own message; a source that is down uses an `ErrorState`, with a retry |
| `asset-transactions.tsx` | `AssetTransactions`, over `QuerySection`, lists the asset's transactions through `GET /v1/transactions` with `symbol`, 10 per page, with the page in `transactionsPage` in the URL, in a `TransactionsTable` without the asset column, with the previous page shown while the next one loads and previous/next navigation with the current page announced (`aria-live`). A page left beyond the last one after a deletion offers to go to the last |

## Feature components — `app/(protected)/assets/_components`

| Component | Lines | Assessment |
| --- | --- | --- |
| `positions-table.tsx` | 934 | It replaced `assets-table.tsx`, which searched only the loaded page. It reads `GET /v1/portfolio/positions` through `usePositions`, with search, filters, sorting and pagination on the server, over the whole portfolio, and the listing's state in the URL. A single bar, with no visible labels (`sr-only` `Label`): search by symbol or name, sent 300 ms after the last keystroke; class ("All classes") and status ("All positions", "Open positions", "Closed positions") in compact selects that stand out in the primary tone when they filter; "Clear" when there is a search or a filter; and, on the right from `lg` up, "Sort by" with the API's eight fields and an order button (`aria-pressed`, "Descending order"), which reaches the fields with no column of their own and sorting on a phone. Seven columns, with sorting in header buttons with `aria-sort`, whose icon only appears on the sorted column or under hover and focus: asset (the symbol, whose link covers the cell and leads to the detail, and the name), quantity ("Qty"), average cost ("Avg. cost"), price, value, allocation and profit or loss with its percentage, the numbers right-aligned in tabular figures, in the base currency and with no computation in the web. They drop from the top down — quantity and average cost below `xl`, where they come back as a secondary line under the value and the price; price below `lg`; allocation below `md`; profit or loss below `sm`, repeated then under the name — and the asset detail keeps the rest. 10, 25 or 50 rows per page, with the previous page dimmed while the new one loads. While loading, a skeleton of 10 rows in the shape of the visible columns; an error with a retry, empty with a shortcut to add an asset and no results with a shortcut to clear search and filters, and the `StaleState` above the table when the new fetch fails. "Refresh" is `RefreshPortfolioButton`. A per-row action menu: "View details", "New transaction" and, separated, "Delete". No TanStack Table: sorting, filtering and pagination are the server's, so its row models would go unused, the page has at most 50 rows, with no selection, resizing or virtualization, and a typed array of columns is enough; it starts to pay off with batch selection, persisted column visibility, resizing or a large volume sorted on the client |
| `assets/page.tsx` | 107 | **Rewritten.** A header with the portfolio's name and base currency and the add-asset button; loading, an error with a retry and a missing portfolio as on the Overview. The add-asset, new-transaction and delete-asset dialogs are `AssetDialogs`', opened from the header and from the table's actions. After a deletion, focus goes to "Add asset" |

## Feature components — `app/(protected)/portfolios`

| Component | Responsibility |
| --- | --- |
| `portfolios/page.tsx` | The portfolios screen, over `QuerySection`, with `GET /v1/portfolios` 10 per page, with the page in `page` in the URL: name, base currency, the active portfolio's mark and the total value (`PortfolioTotalValue`) on each row, with "Use", "Edit" and "Delete", whose accessible names include the portfolio's. "Use" stores the active portfolio choice, and the browser blocking storage becomes an error toast. With a single portfolio, "Delete" goes `aria-disabled`, focusable and described by the rule, which closes the list's card as an `InfoNote` over `--muted`. Loading, an error with a retry, empty with a shortcut to create one and a page beyond the last with a shortcut to it. Deletion asks for the portfolio's name to be typed, with the consequence and the emphasized warning that it is permanent. After deleting, the success toast carries the API's message and focus goes to "New portfolio", because the row that opened the dialog is gone |
| `portfolio-total-value.tsx` | `PortfolioTotalValue`, a portfolio's total value on the portfolios screen's row, through the Overview's `usePortfolioOverview`, in the base currency, right-aligned in a column shared by the rows (`grid-cols-subgrid` from `sm` up). States: a skeleton while loading; "Could not load" in `--negative` with "Retry" when it fails with no cached data (with a cache, it shows the value); "No holdings" with no position with units (`heldPositionCount` `0`), told apart from a real zero, which shows as a value; "Market data unavailable" when a quote or rate is missing (`totalValue` absent) |
| `portfolio-form-dialog.tsx` | `PortfolioFormDialog` creates or edits: the name by the rule in `lib/portfolio-schema.ts`, and the base currency in native radio buttons, with the current one included on edit even when it is not among those offered. On edit, it warns that the currency only changes with no transactions, and "Save changes" is only enabled with a change. A name equal to another portfolio the screen listed (`takenNames`, without the one being edited), compared by `portfolioNameKey`'s key — case and spaces ignored — is refused while typing, and the submission does not go out; the API's 409 marks the field and enters that same set, so the submission stays blocked until the name changes. An API error goes to the `path`'s field or to an alert in the dialog, like the 422 for a locked currency |

## Feature components — `app/(protected)/account`

| Component | Responsibility |
| --- | --- |
| `account/page.tsx` | The account screen: profile and security, each in a section with an `h2`. The security description says only what the section holds; the consequence of the change stays in `PasswordForm`, next to the button. The profile loads with a `LoadingState` and fails with an `ErrorState`; security does not depend on the profile. "Sign out" in the header only below `sm`, where the side menu does not show it, `aria-disabled` while signing out, like the menu's |
| `profile-form.tsx` | `ProfileForm` edits the name, with sign-up's rule, and shows the email, which the API does not change, as text in a definition list. Saving is optimistic: the new name appears at once, in the side menu too, and the `PATCH` response, which carries the saved profile, replaces the cache with no new `GET /api/v1/user`. A failure restores the previous name, revalidates the profile, because a `PATCH` that timed out may have been applied, and shows in the form, as before. It confirms with the API's toast |
| `password-form.tsx` | `PasswordForm` changes the password: current, new with the policy's hint, and confirmation. A wrong current password, the API's `400` with no `details`, goes to its field with focus; the rest follows `presentSubmitError`. In the footer, an `InfoNote` warns that the change ends every session, the current one included, and describes the button through `aria-describedby`; below `sm`, the note sits above the button, which takes the full width. Once the change is accepted, the proxy has already cleared the cookie, and the web clears the cache and goes back to sign-in |

## Forms

A consistent and adequate pattern: `react-hook-form` + `zodResolver`, with the
Zod schema co-located with the dialog. **Keep the pattern.**

`TransactionFormDialog` is the reference: it links the label, `aria-invalid` and
`aria-describedby` to each field, takes the API's error to the field named by
the detail's `path`, or to an alert when no field corresponds, and does not
clear what was typed.

`PortfolioFormDialog` follows the same reference, with the base currency's hint
and error linked to the option group through `aria-describedby`.

**`components/form-field.tsx` — `FormField` and `ChoiceField`.** They extract
the label/hint/error wiring the two forms above did by hand. `FormField`
generates the control's `id`, links `Label`, `aria-invalid` and
`aria-describedby` (hint and error, each only when present; the hint accepts a
node, such as the password's requirement list) and passes that to `children` as
`FieldControlProps` for it to render the `input`; the error enters with
`APPEAR_CLASS`; `isOptional` adds "(optional)" to the label, and `action` puts a
control beside it, such as the "Remove" of the transaction's details, without
changing the label of the fields that do not use it. `ChoiceField` is the same
contract for a `SegmentedControl` group, over a `fieldset`/`legend`: it marks
`data-invalid` on the `fieldset` when there is an error, which the
`SegmentedControl` reads in order to colour the border. Consumed by every form:
transaction, portfolio, instrument registration, sign-in, sign-up, profile and
password.

Gap closed: a server error with no corresponding field, and
`aria-invalid`/`aria-describedby` outside the two reference forms (TASK 14.5) —
`instrument-registration.tsx` mapped the API's `details[].path` to the form's
field (with the `instrument.` prefix removed) and fell back to an alert when no
field corresponded, as the other two already did. That form went out later, with
manual instrument registration.

**`lib/submit-error.ts` — `presentSubmitError`.** The mapping from
`details[].path` to the field, with focus on the first one, and the
`root.server` alert for whatever has no field, previously copied in three forms.
Each form says only how an API `path` becomes one of its fields, through
`fieldOf`, and handles ahead of it the error that has a destination of its own,
such as sign-up's `409` on the email or a wrong current password.

**`lib/account-schema.ts`.** Email, name and the new-password policy, mirroring
the API minus the common-password list, shared by sign-in, sign-up and the
account screen.

**`lib/portfolio-schema.ts`.** The portfolio name, 1 to 60 characters with no
surrounding spaces, mirroring `CreatePortfolioSchema`, shared by the portfolio
dialog and by sign-up's portfolio step.

**`app/(public)/sign-up/_components/sign-up-form.tsx` — `SignUpForm`.** Three
steps in a single form: "Your details" (name and email), "Security" (password
and confirmation, with the email in a hidden `input` with
`autoComplete="username"` for the password manager) and "Portfolio" (the first
portfolio's name, "Main" by default, and the base currency in a
`SegmentedControl`, BRL by default). Enter and "Continue" submit the form;
outside the last step, submitting only validates that step's fields, through
`trigger`, and moves on with focus on the next one's first field. "Back" goes
back without validating, and no value is lost, because the unmounted fields stay
registered. An error that lands on a field from another step — the `409` on the
email, an API `path` or a cross-step rule — brings its step back with the field
focused. The step's header, in `aria-live`, says the title and "Step N of 3",
and the progress bar (`role="progressbar"`, 1 to 3) is a `--muted` track with
the `--primary` fill offset by `translateX` over 500 ms, with no transition
under `prefers-reduced-motion`. Each step's fields change through
`SlideTransition`: moving forward brings the step in from the right, going back
from the left, and the form follows the new step's height. `goToStep` writes the
direction and the step in the same `flushSync`, because focus goes to the step's
first field right afterwards. The payload carries `portfolioName`, which the API
uses in place of "Main".

**`components/password-requirements.tsx` — `PasswordRequirements`.** The new
password's hint on sign-up and on the account screen: the minimum and the email
rule. On the account screen, which passes the typed password, each one is
checked off as it is met while typing, with the state in text for the screen
reader, and an empty password meets none. Sign-up does not pass the password and
gets only the list.

Every form validates on `onChange`: a field only shows an error after receiving
a value, and passing through it without typing does not flag it; submitting
validates them all. On the account screen, changing the new password
revalidates the confirmation if it already has a value. The exception is the
sign-in and sign-up password fields: those two forms use `mode` and
`reValidateMode` `onSubmit` and validate the other fields on every change with
`trigger`, so the password and the confirmation only show or clear an error on
submit (on sign-up, when the step advances). No form disables its fields while
sending; the API's error appears in the form itself, and a toast only confirms
success.

## Data fetching

| Item | Assessment |
| --- | --- |
| `lib/axios/axios.ts` | **Keep.** Two instances — `proxyApi` (browser, `/api`) and `serverApi` (server, `API_URL`) — resolved by `api.getInstance()`. The 401 interceptor clears the token through `/v1/session/expire` and redirects, with the expiry notice only if the user did not end the session themselves |
| `lib/axios/errors.ts` | **Keep.** `ApiProxyError` normalizes the backend's error, and `isNotFoundError` recognizes the 404 by the body's `code`, which reaches the browser through the proxy |
| `lib/api-proxy.ts` | **Keep.** `forwardToApi` forwards to the backend with the cookie's `Bearer`, passes status and body along, and concentrates the proxies' `try/catch`; `jsonPayload` answers `400` to a body that is not JSON |
| `lib/react-query.ts` | **Keep.** Defaults audited in TASK 16.1 and justified in [`data-fetching.md`](data-fetching.md): data fresh for 60 s, no refetch on window focus, and up to two retries that never reach a request rejected with 4xx. Mutations follow the TanStack Query default and do not retry, so that a write whose time ran out is not recorded again and the error reaches the form on the first response |
| `app/api/v1/*/types.ts` | **Keep the pattern** of types co-located per route |

**Domain hooks:** a component knows no URL, no Axios and no query key.
`hooks/use-portfolio.ts` (active portfolio, list, portfolio creation, edit and
deletion, overview, positions, position by symbol, position indicators,
allocation and performance; the positions keep the previous page while the
requested one, with another ordering, search or filter, loads, and none of them
retries the request that answered 404, by the general `retry` rule),
`hooks/use-assets.ts` (asset creation and removal), `hooks/use-transactions.ts`
(listing, which keeps the previous page while the requested one loads, creation,
edit and deletion) and `hooks/use-user.ts` (profile, sign-in, sign-up and
sign-out) build the query or the mutation over the `app/api/v1` proxies. A hook
scoped to a portfolio receives the portfolio and does not fire the request
without it (`skipToken`), through `usePortfolioScopedQuery`, and every write
mutation announces success and invalidates the scope through
`useAnnouncePortfolioChange`, without waiting for revalidation, so the dialog
closes as soon as the API confirms — both in `hooks/use-portfolio.ts`, with a
success toast in the bottom-right corner, which does not take focus and only
appears after the successful response: asset creation says "Asset added" and
which portfolio the symbol entered and, when the screen offers it, carries the
"Add transaction" action, with 10 s instead of `sonner`'s 4 s and dismissed when
the screen that announced it leaves, and the transaction one says what it
recorded ("Buy recorded") and the quantity, the symbol, the unit price in the
transaction's currency and the day; edit and deletion repeat the API's message.
The failure of a creation opens no toast: it stays in the dialog, beside the
field or in the form's alert, with what was typed preserved; a mutation with no
portfolio fails, with a toast on the asset ones and in the dialog that fired it
on the transaction ones, which open no error toast.

**Query keys and invalidation:** every query key comes from `queryKeys`, in
`lib/react-query.ts`, in the shape `[root, ...scope, resource, parameters]`:
`['user']` for the profile, `['portfolios', 'page', page]` for the portfolio
list, `['portfolios', 'details', portfolioId]` for the chosen portfolio and
`['portfolio', portfolioId, resource, parameters]` for what belongs to a
portfolio — `overview`, `positions`, `position`, `allocation`, `performance` and
`transactions`, and `['portfolio', portfolioId, 'position', symbol,
'indicators']` and `['portfolio', portfolioId, 'position', symbol,
'fundamentals']` for the position's indicators and fundamentals, which the
position's invalidation reaches. The parameters are the request's own, never a
derived value, such as another query's refresh time. Every successful write on a
portfolio, and the "Refresh" of the Overview and of the assets screen,
invalidate `['portfolio', portfolioId]` through `useRefreshPortfolio`: the
scope's active queries fetch again, the inactive ones go stale, and the ones
disabled by `skipToken` stay out. The public layout discards the whole cache on
mount, and a session 401 reloads the page at `/sign-in`; that is why the keys do
not carry the user (see TD-023 on the `QueryClient` on the server).

## State

| Item | Assessment |
| --- | --- |
| `providers/app-provider.tsx` | **Keep** — QueryClient, theme, toaster, progress bar, error boundary. The toaster is `components/toaster.tsx` |
| `hooks/use-user.ts` | **Keep.** The caller's profile through `GET /api/v1/user` and the sign-in, sign-up, sign-out and password-change mutations; the previous session's cache is discarded by the public layout, after the protected screens unmount |
| `hooks/use-page-param.ts` | `usePageParam`, a listing's page in a URL parameter, with the name given by the caller: `page` on the portfolios, `positionsPage` on the Overview and `transactionsPage` on the asset detail. A value that is not a page shows the first, and the first leaves the URL. Reading the value is `pageNumberFrom`, from `lib/pagination.ts`, the same one the positions table uses, which previously accepted any integer — `?page=1e300` reached the API and came back as an error |

**The server↔UI boundary:** server data — portfolio, overview, positions,
allocation, performance, transactions and profile — comes only from React Query.
The URL keeps what a refresh or a link needs to reproduce: search, filters,
ordering, size and page of the positions table, the page of the other listings
and the chart's period, through `updateUrlQuery`, which pushes, so that Back
undoes the change. A dialog does not enter the URL. `useState` holds the rest of
the interface state: the open dialog and the symbol it acts on, the selected
transaction and the action on it, and the text typed into the search. The tables
display the canonical pagination from the response and format the values in the
currency the response reports.

## Utilities

| Item | Assessment |
| --- | --- |
| `lib/utils.ts` → `cn()` | **Keep** |
| `lib/pagination.ts` | **New.** `FIRST_PAGE`, the first page of the API's listings, previously redeclared in six files, and `pageNumberFrom`, which reads the page from a URL parameter: a safe integer from 1 up, or the first page |
| `lib/motion-features.ts` | **New.** The framer-motion feature bundle (`domMax`, which includes the shared indicator's layout animation), in a module of its own so that `MotionScope` can load it through `import()` |
| `lib/motion.ts` | **New.** `TAB_SPRING`, the tabs' spring (300 ms, 0.25 bounce); `TAB_PANEL_VARIANTS`, the panel that enters 32 px offset in the navigation's direction and leaves in the opposite one, with a shorter fade on the way out than on the way in; `TAB_PANEL_HEIGHT_TRANSITION`, the same spring without bounce, so that what sits below the panel does not jump. `APPEAR_CLASS`, `tw-animate-css`'s 200 ms entry fade, for what replaces a load or answers an action: the content of `QuerySection`, `EmptyState`, `ErrorState`, `FormField`'s error, `AuthNotice`, the asset detail's price block and the price chart, which fades again on every chosen window. Nothing enters animated for decoration alone; under `prefers-reduced-motion`, `globals.css` shortens every animation |
| `lib/toast-lifetime.ts` | **New.** `TOAST_LIFETIME_MS`, `sonner`'s default 4 s, and `toastLifetimeOf`, which gives a toast its `duration` and the countdown bar's `--toast-lifetime` together, so that the two never diverge |
| `common/utils.ts` → `formatNumber`, `formatMoney`, `formatPrice`, `formatUnitAmount`, `formatQuantity`, `formatPercent`, `formatDecimal`, `currencyFractionDigits`, `currencySymbolOf`, `signedValueTone` | **Promote to primitive.** Central formatters, shared by the assets screen, by the asset detail and by the Overview: price and quantity with the decimal places of the value received, the value of one unit with at least 4 significant digits, so that a price below a cent does not become zero, percentage with two places, value in fixed places for `MoneyInput`, the places of each currency's smallest unit, and the colour from the sign; they become the base of `Money`/`Percentage` (TASK 12.2). `currencySymbolOf` takes from the same `Intl.NumberFormat` as `formatMoney` the symbol the transaction form's amount field shows; the `CURRENCIES` table, which repeated R$, $ and € by hand, is gone, and a portfolio in another currency gets its own symbol (£, ¥) instead of the code. The currencies offered on portfolio creation and on sign-up are `OFFERED_CURRENCIES`, with `DEFAULT_CURRENCY` |
| `lib/dates.ts` | **New.** All of the web's date handling, over Day.js with the `utc` and `customParseFormat` plugins. The API receives and returns instants in ISO 8601 and stores them in UTC (`TIMESTAMP(3)`); a performance series' day is its UTC midnight. Here live the formatting — quote, execution and series day, the last in UTC —, reading an instant as a day (`YYYY-MM-DD`) in the browser's time zone, and the way back: `instantOfCalendarDay` returns, for the chosen day, the later of local midnight and UTC midnight, the first instant that falls on that day in both zones, because the table shows the execution in the browser's time zone and the performance series counts it on its UTC day; any offset, from −12 to +14 hours, names the same day in both readings. `access-token.ts` stays with `Date`, because it converts the JWT's `exp`, a protocol instant, not a calendar date |
| `lib/decimal.ts` | **New.** Exact decimals in the web: the limits of `DECIMAL(38,18)`, `readDecimal` for what a person types or pastes, with both separator conventions and the ambiguous comma refused, and arithmetic in units of `10^-scale` in a `bigint` — round to a scale, add whole units — never passing through `number` |
| `common/utils.ts` → `truncateText`, `sanitizeInputValue` | **Keep** |
| `common/utils.ts` → `updateUrlQuery` | **Keep.** Writes the query through the native History API, `pushState`, which the App Router synchronizes with `useSearchParams` as of Next 14.1; it replaced `replaceUrl`, whose conflict with the router TASK 13.3 had foreseen. `replaceUrlQuery`, which replaced the entry when a dialog opened and closed through the URL, went out with it |
| `common/constants.ts` | **Keep and expand** — routes, including the asset detail's by symbol, cookies, currencies, fonts, labels and tones of the transaction types, and each type's price label |
| `types/index.ts` | **Keep** the utilities (`Maybe`, `WithId`, `Pagination`); **remove** `TailwindColors*`, coupling to Tailwind's palette with no justified use |

## Relevant duplication

1. **Financial calculation in three places** — `dominance`/`totalInvestedValue`
   in the proxy (`api/v1/assets/route.ts`), average cost in
   `asset-transaction-table-cell.tsx`, `investedValue` in the backend. A single
   source of truth in PHASE 5. **Resolved:** the transaction component went out
   along with the per-symbol listing, the proxy was removed, and the web
   displays the values the backend computes, such as the allocation and the
   per-position result of `GET /v1/portfolio/positions`.
2. **An identical `try/catch` block in all 9 proxy routes** — the same 4 lines
   reading the cookie plus the same `catch`. A candidate for a single wrapper.
3. **An identical `catch` block in the backend's 16 controllers** — resolved by
   the global error handler (TASK 1.6).
4. **Two icon packages**: `react-icons` and `lucide-react`, both in use in the
   same files (`add-asset-dialog.tsx`, `sidebar.tsx`, `app-provider.tsx`).
   **Resolved:** the bundle audit found a third one as well,
   `@radix-ui/react-icons`, in the primitives. All of them moved to
   `lucide-react`, and the other two left `package.json`. See
   [`performance.md`](performance.md), §Bundle.
5. **A Zod schema duplicated between front and back** — `add-asset-dialog.tsx`
   repeats `InstrumentSearchTermSchema`'s pattern and 120-character limit with
   no shared contract. Manual registration, which repeated
   `InstrumentAttributesSchema`'s limits, is gone: the instrument's attributes
   come from the provider, in the backend.

## Excessively specific components

* `assets-table.tsx` — coupled to `LimitPerPageOptions` and to the `PageRequest`
  type imported from `../page`, a de facto circular dependency between page and
  component. **Resolved:** the positions table that replaced it defines its own
  options and imports nothing from the page.

## Candidates to become primitives

| Origin | Destination primitive | Task |
| --- | --- | --- |
| `formatNumber` + `CURRENCIES` | `Money`, `Percentage` | 12.2 |
| colour from the sign in `signedValueTone` and `SignedAmount` of `components/amounts.tsx` | `ProfitLoss`, `Trend` | 12.1 / 12.2 |
| `Skeleton` in ad-hoc use | `LoadingState` | 12.4 |
| `QuerySection` and `LoadErrorAlert` | `EmptyState`, `ErrorState`, `NoResultsState`, `StaleState` | 12.4 |
| the header repeated in `assets/page.tsx`, `account/page.tsx` and `(overview)/page.tsx` | `PageHeader`, `SectionHeader` | 12.3 |

## Summary

**Keep with no relevant change:** the `components/ui` primitives that survived
TASK 20.3, the axios layer, the app providers, the form pattern, the
per-route type pattern.

**Refactor:** `common/utils`. `sidebar` was redesigned — see the entry above.

**Rewrite:** `assets-table` and `assets/page`, already rewritten; the table gave
way to `positions-table`. `add-asset-dialog` as well, today a single search view
over the instruments already seen and the provider's listings.

**Create:** financial primitives, data-state components, chart layer. Mobile
navigation already exists, in the `sidebar`'s own `nav` — a bottom bar below
`sm`.
