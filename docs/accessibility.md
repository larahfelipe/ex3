# Accessibility baseline

Normative frontend checklist (`web/src`), used as the criterion for TASKS 14.2
to 14.7 and for every later task that touches the UI. Each item is a verifiable
rule, with the means of verification and the point in the code that guarantees
it today.

## Reference

| Item | Value |
| --- | --- |
| Standard | WCAG 2.2, level AA |
| Scope | `web/src` — `(public)` and `(protected)` routes, primitives in `components/ui` |
| Capture commit | `995b0bf` |
| Capture date | 2026-09-19 |
| Document language | `<html lang="en">` in `app/layout.tsx` (1.3.1 / 3.1.1) |

Out of scope: the backend, email and any surface without HTML.

## Available enforcement

| Layer | Mechanism | Coverage |
| --- | --- | --- |
| Static | `eslint-plugin-jsx-a11y` (`flatConfigs.recommended`) in `pnpm lint`, with `--max-warnings=0` | Invalid ARIA attributes, a handler on a non-interactive element, a missing `alt`, a label with no control |
| Structural | `PageHeader`, `SectionHeader`, `LoadingState`, `EmptyState`, `NoResultsState`, `ErrorState`, `StaleState` | Heading hierarchy and state announcement by composition, not by repetition |
| Behavioural | Radix (`dialog`, `alert-dialog`, `select`, `dropdown-menu`, `tooltip`) | Trapped focus, `aria-modal`, Esc, arrow-key navigation |
| Manual | The keyboard script of TASK 14.3 and the audit of TASK 14.7 | What none of the previous layers reaches |

Automation covers part of the set; no item below counts as met merely because
`lint` and axe passed.

## 1. Keyboard

| # | Rule | Verification |
| --- | --- | --- |
| K1 | Every action is reachable with `Tab` in DOM order; no positive `tabIndex` | 2.1.1, 2.4.3 · `tabIndex` sweep + manual walkthrough |
| K2 | `Enter` and `Space` activate a `<button>`; `Enter` activates a link | 2.1.1 · native elements only; no `<div>` with `onClick` |
| K3 | `Esc` closes a dialog, a dropdown and a select without losing what was already typed | 2.1.2 · Radix's default behaviour, not overridden |
| K4 | `Arrow` navigates within a menu, a select and a radio group; `Tab` leaves the group | 2.1.1 · `dropdown-menu`, `select` and the chart's period `fieldset` |
| K5 | No keyboard trap outside a modal dialog | 2.1.2 · full walkthrough with `Tab` and `Shift+Tab` |
| K6 | Minimum touch target of 24×24 px; 44×44 px in the main navigation | 2.5.8 (AA) and 2.5.5 as an internal rule · `NAVIGATION_ITEM_CLASS` in `sidebar.tsx` |
| K7 | Authentication accepts pasting into a password field and requires no transcription of a secret | 3.3.8 · `sign-in` and `sign-up` with no `paste` blocking |

## 2. Focus

| # | Rule | Verification |
| --- | --- | --- |
| F1 | A visible indicator on every focusable element, with the pair `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` and `ring-offset-background`, without which Tailwind 4 paints the gap white | 2.4.7 · `components/ui/button.tsx`, `input.tsx`, `checkbox.tsx` and every component's own control |
| F2 | Opening an overlay moves focus inside it | 2.4.3 · Radix; no competing `autoFocus` |
| F3 | Closing an overlay returns focus to the originating element | 2.4.3 · Radix, provided the trigger is still mounted on close |
| F4 | No focused element is removed from the tree without focus going to a predictable destination | 2.4.3 · changing page, clearing filters, deleting a row; `QuerySection` returns focus to the section's `<h2>` when the content changes and focus falls to `body` |
| F5 | The focused element is not covered by the fixed navigation bar or by an overlay | 2.4.11 · `sm` viewport with the bottom bar; `--navigation-bar` already reserves the space in `(protected)/layout.tsx` |
| F6 | Focus does not change context because of typing or of a value change | 3.2.1, 3.2.2 · search, filter selects and forms |

## 3. Semantics

| # | Rule | Verification |
| --- | --- | --- |
| S1 | One `<h1>` per route, coming from `PageHeader`; a section with an `<h2>` from `SectionHeader` referenced by `aria-labelledby` | 1.3.1, 2.4.6 · heading inventory |
| S2 | `<nav aria-label>`, `<main>` and `<header>` unique and siblings; no nested landmark without a label | 1.3.1, 2.4.1 · `sidebar.tsx` and `(protected)/layout.tsx` |
| S3 | An action is a `<button>`; navigation is an `<a>`/`Link`. No primary action on a clickable `<div>` | 1.3.1, 4.1.2 · TASK 14.2's completion rule |
| S4 | A table uses `<th>` with a scope, a `<caption>` describing the content and `aria-sort` on the sorted column | 1.3.1 · `positions-table.tsx`, `transactions-table.tsx` |
| S5 | A set of sibling items is a list (`ul`/`ol`/`dl`); metrics sit in `dt`/`dd` | 1.3.1 · `sidebar.tsx`, `Metric` in `financial.tsx` |
| S6 | A decorative icon carries `aria-hidden="true"`; an icon-only control carries an `aria-label` | 1.1.1, 4.1.2 · sweep of the `lucide-react` icons |
| S7 | The current navigation item's link carries `aria-current="page"` | 4.1.2 · `sidebar.tsx` |

## 4. Contrast

| # | Rule | Verification |
| --- | --- | --- |
| C1 | Normal text ≥ 4.5:1 and large text ≥ 3:1 against its own background | 1.4.3 · measured per token/surface pair |
| C2 | A border, a state and the focus indicator ≥ 3:1 against what is adjacent | 1.4.11 · `--border`, `--focus`, `--input` |
| C3 | Colour is the only vector of no information: a sign, a label or an icon accompanies the tone | 1.4.1 · `signedValueTone`, `Trend`, `ProfitLoss` |
| C4 | No literal colour in the code: everything comes from the tokens in `globals.css` | 1.4.3 · sweep for `#`, `rgb(` and `hsl(` outside `globals.css`; the single exception, `APP_THEME_COLOR`, the theme's `--background` in hex for `theme-color`, which the browser reads without resolving a token |
| C5 | Text resizable to 200% and reflow at 320 px with no loss of content | 1.4.4, 1.4.10 · relative units; verified alongside PHASE 15 |

The semantic tokens' light palette has no runtime consumer — see TD-048; C1 and
C2 hold today over the dark palette, but both palettes go through computation
since the correction recorded in TD-053. `color-scheme` is declared per theme in
`:root` and `.dark`, so that scrolling, selection and the native controls
(`<select>`, checkbox, scrollbar) follow the active palette instead of the
browser's default. The measured ratios are in §Measured contrast.

## 5. Forms

| # | Rule | Verification |
| --- | --- | --- |
| P1 | Every input has an accessible name through `<Label htmlFor>`; `aria-label` only when there is no visible label | 1.3.1, 3.3.2, 4.1.2 · `jsx-a11y/label-has-associated-control` |
| P2 | A field's error is associated through `aria-describedby` and marked with `aria-invalid` | 3.3.1 · `FormField`/`ChoiceField` in every form |
| P3 | The message describes what to correct, not only that it failed | 3.3.3 · the text of the Zod messages |
| P4 | A required field is communicated to the AT and visually | 3.3.2 · `required`/`aria-required` |
| P5 | An identity or credential field has `autocomplete` | 1.3.5 · `sign-in`, `sign-up`, `account` |
| P6 | The submit result — success and failure — is announced without stealing focus | 4.1.3 · `role="alert"` in the form and a `sonner` toast |
| P7 | Data already provided in the flow is not asked for again without need | 3.3.7 · the chained asset and transaction dialogs |

## 6. Dialogs

| # | Rule | Verification |
| --- | --- | --- |
| D1 | Every modal overlay comes from Radix `Dialog` or `AlertDialog`; no modal of our own | 2.1.2, 4.1.2 · `components/ui/dialog.tsx`, `alert-dialog.tsx` |
| D2 | Every dialog has a real `DialogTitle` and `DialogDescription`, even when visually hidden | 4.1.2 · dialog inventory |
| D3 | A destructive confirmation uses `AlertDialog`, with the destructive action labelled by its effect | 3.3.4 · asset and transaction deletion |
| D4 | Closing by Esc, by the overlay and by the button leads to the same state | 2.1.2 · manual test |
| D5 | No dialog opens another stacked dialog, except the edit and deletion that start from the transaction detail: they open on top of it so that cancelling returns to the detail with focus on the originating button | 2.4.3 · the asset → transaction flow closes the first before opening the second; `transactions-table.tsx` |

## 7. Dynamic content

| # | Rule | Verification |
| --- | --- | --- |
| N1 | Loading uses `LoadingState`: `<output aria-busy="true">` with an `sr-only` label and an `aria-hidden` skeleton | 4.1.3 · `data-state.tsx` |
| N2 | A recoverable failure uses `ErrorState`/`StaleState` with `role="alert"` and a retry action | 4.1.3, 3.3.1 · `data-state.tsx` |
| N3 | Count, pagination and total change inside `aria-live="polite"` | 4.1.3 · `PageNavigation`, in `page-navigation.tsx`, in the four paginated listings |
| N4 | A toast is never the only channel of an error that blocks the task | 4.1.3 · the state also appears in the affected region |
| N5 | Stale data displayed during a refetch is marked with `aria-busy` on the container | 4.1.3 · `isPlaceholderData` in `positions-table.tsx` and `performance-chart.tsx` |
| N6 | Under `prefers-reduced-motion`, non-essential animation and transition are neutralized in `globals.css`; the busy indicator keeps spinning, more slowly. framer-motion follows the same preference: `MotionScope` (`MotionConfig reducedMotion="user"`) turns off the slide of the panels and of the `SegmentedControl`'s indicator, which merely change place, and keeps the fade; the panel's height, which is not a transform, changes with no transition through `useReducedMotion`. Under `prefers-reduced-transparency`, the dialogs' overlay loses the blur and becomes more opaque | 2.3.3 · the `@media (prefers-reduced-motion: reduce)` block; touch transform under `motion-safe:`; `MotionScope` and `SlideTransition` |
| N7 | No automatic content update outside the user's control | 2.2.2 · a refetch is fired by an action or by a mutation's invalidation |

## Known gaps at capture

Observed while writing this checklist, each one addressed in the task
indicated:

| Gap | Rule | Task |
| --- | --- | --- |
| There is no "skip to content" link; with the navigation before `<main>`, every keyboard visit crosses the section list | K1, 2.4.1 | 14.2 |
| `animate-pulse` on the brand and `animate-spin` in `add-asset-dialog.tsx` run outside `motion-safe` | N6 | 14.6 |
| `active:scale-90` on the navigation items has no reduced variant | N6 | 14.6 |
| Error association through `aria-describedby`/`aria-invalid` is not uniform across the forms | P2 | 14.5 |
| `autoComplete="off"` in `sign-in-form.tsx` and `sign-up-form.tsx` defeats the field's declared purpose and password-manager filling | P5, K7 | 14.5 |
| Token contrast was never measured, in either palette | C1, C2 | 14.7 |
| No automated audit runs in the repository | — | 14.7 |

Closed since the capture: the skip link and the landmarks in `8a3ef68`; the
chart's scrollable region in `b01bf45`; the focus destination after closing an
overlay in `e8cb974`; accessible name, error association, required state and
`autocomplete` in `717ada7`; reduced motion in `b6bda64`; the automated audit in
TASK 20.6, measured in §Automated audit. The contrast line was closed in TD-053,
with the measurement in the section below.

## Measured contrast

A deterministic measurement of the `app/globals.css` tokens, in both palettes,
restricted to the pairs the code actually produces — each `text-*` over the
surface where it appears in `web/src`. Method: the token's HSL converted to
sRGB, relative luminance and the WCAG 2.x contrast ratio, with 4.5:1 for normal
text (1.4.3) and 3:1 for a component boundary and a state indicator (1.4.11); a
background with alpha, such as `bg-warning/10`, composited over `--background`
before measuring. No browser is needed to repeat the measurement — the inputs
are the tokens themselves.

The 78 pairs measured in each palette pass the threshold of the rule they
exercise, as of the palette revision of 2026-09-24 (below): text of each tone
over background, surface and elevated surface, a solid button's label including
on hover, text over the tone at 10%, field border, focus ring and each chart
colour over the card. The script lives outside the repository; the inputs are
the tokens alone. In the TD-053 correction, the six pairs that failed were fixed
in the token's value only, with no change of usage class. The values are the
current ones, with the pre-TD-053 ones in parentheses:

| Pair | Where it appears | Light (was) | Dark (was) | Threshold |
| --- | --- | --- | --- | --- |
| `--destructive` as text | the deletion action in `transaction-details-dialog.tsx`, in the row menu of `positions-table.tsx` and in the list of `portfolios/page.tsx` | 5.75:1 (3.76:1) | 7.02:1, 5.97:1 over `--surface-elevated` (2.01:1) | 4.5:1 |
| `--primary-foreground` over `--primary` | the label of every primary button; `/0.9` on hover | 5.57:1, 4.66:1 on hover (16.95:1, with the navy `--primary`) | 5.71:1, 4.78:1 on hover (3.49:1) | 4.5:1 |
| `--border`/`--input` over `--background` | field border, the control's only visual cue | `--input` 3.52:1 (1.24:1) | `--input` 3.63:1, 3.08:1 over `--surface-elevated` (1.33:1) | 3:1 |
| `--destructive-foreground` over `--destructive` | solid deletion button; `/0.9` on hover | 5.50:1, 4.84:1 on hover (3.60:1) | 6.53:1, 5.44:1 on hover (9.59:1) | 4.5:1 |
| `--muted-foreground` over `--muted` | secondary text on a highlight surface | 4.91:1 (4.39:1) | 5.37:1 (6.00:1) | 4.5:1 |
| `--warning` over `bg-warning/10` | alert chip | 5.00:1 (4.40:1) | 9.63:1 (10.28:1) | 4.5:1 |

`--border` remains below 3:1 in both palettes (1.24:1 light, 1.42:1 dark) by
decision: since the correction it is a decorative separator only, and every
interactive control — input, select, segmented control — uses `--input` for the
border, which passes. In the dark palette, `--input` sits at 42% lightness, the
minimum that still yields 3:1 over `--surface-elevated`, the lightest background
under a field, the one every dialog has: the border is as discreet as 1.4.11
allows. `AlertDialog`/`Dialog` uses `bg-scrim` instead of `bg-black` for the
overlay — at 60% with blur, or at 80% without blur under
`prefers-reduced-transparency` — and `Input`/`SelectTrigger`/the notes textarea
gained `aria-invalid:border-negative`, so the invalid state is also visible
outside focus.

The remaining pairs pass in both palettes, with room to spare: default text
20.14:1 and 18.48:1; `--muted-foreground` over `--background` 5.40:1 and 7.65:1;
`--negative` 5.42:1 and 7.02:1; `--positive` 5.96:1 and 10.05:1; `--info` 5.94:1
and 9.17:1; focus ring 20.14:1 and 6.15:1, 5.23:1 over `--surface-elevated`; the
weakest chart colour, 3.02:1 (`--chart-9`, light) and 4.68:1 (`--chart-1`,
dark), over the card.

The light palette still has no runtime consumer (TD-048): the measurement proves
it would pass if enabled, not that it was seen rendered. TD-053 is resolved —
the six pairs pass by computation in both palettes — but the light palette
remains without a real visual audit until TD-048 is addressed.

### Palette revision — 2026-09-24

Each change corrects a measured defect or a rule of the palette; none is
taste alone.

| Change | Reason |
| --- | --- |
| Dark: `--background` 2.9% → 5.5%, `--surface` 6% → 9.2%, `--surface-elevated` 3.9% → 12.3%, in L* (CIELAB) 4, 8 and 12 | the elevated surface was darker than the card, so a menu, select, popover and toast opened over a card looked sunken, and only the border separated them; a shadow barely shows over a dark background, and elevation has to come from lightness, in equal steps. The background leaves near-absolute black (`#070707`), which left no step below the card: 2.4 L* points between the two |
| Dark: `--muted`, `--secondary`, `--accent` and `--border` 14.9% → 18.1% (L* 19) | hover, focus and menu-item selection (`--accent`) and highlight (`--muted`) sit 7 L* points above the elevated surface, the lightest one they appear on; at 14.9% it would be 3. The border follows, so that the `DialogFooter`'s divider stays visible over the dialog |
| Dark: `--input` 38% → 42% | the minimum that yields 3:1 over the new elevated surface, the one every dialog has |
| `DialogContent` and the `SeriesChart`'s reading: `bg-background` → `bg-surface-elevated` | they were the screen's topmost layer and the darkest one; the dialog looked almost identical to the page darkened by the scrim |
| Light: `--primary` navy → `21 100% 35%` | orange is the identity colour, the one in the dark theme and in the lines of the sign-in image; the blue was shadcn's default. It is the lightest orange of that hue at which the button's label passes 4.5:1 on hover as well; the dark palette's `21 100% 50%` would give 3.14:1 as text over white |
| Light: `--positive` 24% → 23% and `--negative` 51% → 47% | they failed in pairs the code produces: the `success` button's label on hover, 4.40:1, and negative text over `bg-negative/10`, in the authentication notice and in the "Sign out" hover, 4.11:1 |
| `ring-offset-background` on the sort button of `positions-table.tsx` and on the `summary` of `performance-chart.tsx` | Tailwind 4.3 paints the `ring-offset-2` gap with `--tw-ring-offset-color`, `#fff` by default: both painted a white band between the control and the orange ring in the dark theme |
| `theme-color` from `#070707` to `APP_THEME_COLOR` (`#0e0e0e`) | follows the new `--background`; the name and the comment tie the literal to the token |

Left as they were: the chart colours, which pass 3:1 over the card in both
palettes; the achromatic neutrals, because tinting them would be aesthetics
alone; `positive` and `negative` as the success and error tokens, which the
toast and the notices already use, without the `success` and `error` aliases,
which would have no consumer of their own; and the disabled state at
`opacity-50`, outside 1.4.3. The revision is by calculation and by reading the
code: no browser rendered the new palette.

## Automated audit — TASK 20.6

Run on 2026-09-20 against the production build served by `next start`, with the
API and the development database and an account seeded with one position
(`PETR4`) and two purchases, so that a table with rows, a chart with a series
and a deletion dialog would actually exist.

| Item | Value |
| --- | --- |
| Tool | axe-core 4.10.3, injected into the page |
| Browser | headless Firefox driven by WebDriver BiDi over Node 24's global `WebSocket`, with neither Playwright nor Selenium |
| Target | `http://localhost:3010`, build of commit `801839c` |
| Viewports | 1280×800 and 390×844 |
| Rules | axe's default set: WCAG 2.0/2.1/2.2 A and AA plus best-practices |

### Result

Violations per state, with the node count:

| State | 1280×800 | 390×844 |
| --- | --- | --- |
| `/sign-in` with no session | — | `color-contrast` ×2 |
| `/sign-up` with no session | — | `color-contrast` ×2 |
| `/` | — | `color-contrast` ×2 |
| `/assets` | — | `color-contrast` ×1 |
| `/assets/PETR4` | — | `color-contrast` ×2 |
| `/account` | — | — |
| `/assets` with the asset dialog open | — | `color-contrast` ×1 |
| `/assets` with a search that returns nothing | — | `color-contrast` ×1 |

No violation of `critical` impact in any state, in either viewport, and no rule
other than `color-contrast` failed — the "axe with no critical violation"
criterion is met.

### Contrast as measured by axe

Every failing node was the same pair: `#fef2f2` over `#e65000`, 3.48:1 against
the 4.5:1 minimum — `--primary-foreground` over `--primary`, which §Measured
contrast computed as 3.49:1 from the token. The nodes were the primary button's
label and the selected chip of the chart's period and grouping radio groups. The
audit in the next section confirms that the corrected token resolves all three
nodes.

At 1280×800 the `color-contrast` rule comes back as **incomplete with zero
nodes** on every page: at that width it evaluated nothing in this harness, while
on a trivial control page it evaluates normally at any width. The dash in the
desktop column above is an absence of measurement, not an absence of defect — on
wide screens contrast remains covered by the previous section's static
measurement, which starts from the same tokens.

### Incomplete results that require manual review

`aria-hidden-focus` ×3, in both viewports, while a dialog is open: Radix marks
the modal content's siblings with `aria-hidden="true"` and they remain tabbable
in the DOM. For a screen reader the content is correctly hidden; what contains
the keyboard is Radix's focus trap, which this harness cannot exercise — see
Harness limits.

### Keyboard and focus

| Verification | Result |
| --- | --- |
| Tab order on `/assets` with data | skip to content → navigation → account → sign out → add asset → refresh → search → two filters → eight sortable headers → symbol link → row actions → pagination; no positive `tabIndex` and no trap (K1, K5) |
| Row action menu | `Enter` opens it, `aria-expanded` follows, `Arrow` walks the items, `Enter` selects (K4) |
| Deletion `AlertDialog` | labelled and described by id, siblings hidden, `Tab` cycles between `Cancel` and `Confirm` without leaving, `Esc` closes without deleting (D2, D3, D4); on portfolio deletion, focus opens on the name field, labelled by the instruction, and `Confirm` stays `aria-disabled` and focusable until the name matches, with the field's error linked through `aria-describedby` |
| The chart's text alternative | the `summary` "Performance as a table" is focusable and opens a 247-row table with an `sr-only` `caption`; axe stays clean with it open (1.1.1) |
| Announced structure | one `h1` per route, an `h2` per section with `aria-labelledby`, no control without an accessible name, `lang="en"` (S1, S2, S6) |

### Fixed in this task

| Finding | Fix |
| --- | --- |
| `link-in-text-block`: the link inside the `sign-in` and `sign-up` paragraph was distinguished by colour alone (1.4.1) | a permanent underline on the inline link |
| Every route served the same `<title>`, without identifying the page (2.4.2) | `title.template` at the root and a title per segment, including `generateMetadata` on the asset detail |
| Closing an overlay left focus on the `body` (F3): Radix returns focus to the `DialogTrigger`, and no dialog here uses a trigger — they all open from state, so `triggerRef` is always null | `hooks/use-focus-return.ts`, applied in `components/ui/dialog.tsx` and `alert-dialog.tsx` |

The flow that opens the dialog from the row menu still loses focus on close, for
a reason distinct from the one fixed above: it is in TD-066, resolved in the
audit of 2026-09-22.

### Harness limits

- The headless window never receives activation: `document.hasFocus()` is always
  `false` and Firefox fires neither `focus`, `focusin` nor `blur`, although
  `document.activeElement` does change. Two consequences: `:focus-visible` never
  matches, so the focus ring cannot be observed rendered and F1 remains verified
  by the class pair in the code; and Radix's focus trap, which depends on
  `focusin`, does not run, so neither keyboard containment in the modal nor
  recovery from stolen focus can be measured here.
- Lighthouse was not run: the package is not installed. TASK 14.7's
  "accessibility ≥ 95" criterion remains unverified, in TD-054.
- A real screen reader (NVDA, VoiceOver), the clarity of an error message and
  the equivalence of alternative content remain in this document's manual
  script — no tool decides them.

## Automated audit — instrument registration and side menu (2026-09-21)

Run against `next dev` with a seeded account (`PETR4` from the catalog, a
private instrument and one position of each), headless Firefox over WebDriver
BiDi and axe-core 4.11.1, in both palettes and at 1280×800, 820×1180 and
390×844 — harness and limits in §Automated audit — TASK 20.6.

### Fixed in this task

| Finding | Fix |
| --- | --- |
| `fieldset disabled={isSubmitting}` in every dialog form disabled the fields as soon as `handleSubmit` called `setValue`, and the `blur` fired by `disabled` ran ahead of RHF's `setFocus`: focus fell to the `body`, not to the first invalid field (F4, 3.3.1) | a `fieldset` with no `disabled` in `instrument-registration.tsx`, `add-asset-dialog.tsx`, `transaction-form-dialog.tsx` and `portfolio-form-dialog.tsx`; the view-switch button (catalog ↔ registration) and the "Search the catalog" link stay disabled during submit, individually |
| `RegistrationForm` registers the fields in the form's order, with the class and market `SegmentedControl`s ahead of symbol and name; RHF's `shouldFocusError` focuses in that registration order, not in the visual one, so an empty symbol focused "Stocks" (2.4.3, F6) | `shouldFocusError: false` plus a focus handler that walks `REGISTRATION_FIELDS`, the visual order, and focuses the first field with an error |
| `ChoiceField` (radio group) had no visual error cue at all — only the message below indicated the invalid field, unlike `Input`, which already gets a red border (1.4.1, 3.3.1) | `data-invalid` on the `fieldset` plus `in-data-invalid:border-negative` on `SegmentedControl` |
| The scrollable positions table's `section[aria-labelledby]` had the same label ("Positions") as the `<h2>` of the section containing it, so on screens that need to scroll (≥768px of table, <820px of viewport) the two landmarks were indistinguishable (`landmark-unique`, 1.3.1, 2.4.1) | `label="Positions table"` and `"Transactions table"` on `Table`, distinct from the section's heading |
| `Dialog`/`AlertDialogContent` had no `outline` of its own; in a dialog whose content scrolled (instrument registration on short screens), nothing visually indicated the modal's boundary when focus was on an already visible control (2.4.11) | `outline-hidden` on the content, alongside each inner control's focus ring, which already sufficed — a preventive change, with no associated failing finding |

After the fixes, zero axe violations on every page, every dialog and both
palettes, in the three viewports.

### Persistence with no server consumer

The side menu's expanded/collapsed state is read from the `ex3:navigation`
cookie in `(protected)/layout.tsx` before the first render, so toggling,
reloading and reopening the application never produces the menu in the wrong
state for an instant (2.4.3, no flash); verified in the harness by toggling,
reloading with the cookie already written and checking the `nav`'s width on the
first paint.

## UX/UI and accessibility audit (2026-09-22)

A review by reading all of `web/src`, organized in stages, each with the `web`
gates (`lint`, `typecheck`, `build`) and a commit of its own.

### Primitives and tokens

| Finding | Fix |
| --- | --- |
| `SelectTrigger` and the `Dialog`'s close button showed the ring with `focus:`, including after a click; the rest of the controls use `focus-visible:` (F1) | the `focus-visible:` pair on both; the skip link stays on `focus:`, because it only exists on screen while focused |
| The `Dialog`'s close button at 16×16 px, below the minimum target (K6, 2.5.8) | a 24×24 px target with the icon on the same centre; the `data-[state=open]:` classes went out, which Radix's `DialogClose` never receives |
| The performance table's `summary` and the positions table's sort button used `outline-none`, which also erases the outline under `forced-colors` | `outline-hidden`, as in the rest of the code |
| A destructive action in text alternated between `text-negative` and `text-destructive`; `--negative` over `--accent`, the focused menu item's background, gives 4.36:1 in the light palette | `text-destructive` on every deletion action: 5.23:1 light and 5.51:1 dark over `--accent`, 7.21:1 dark over `--surface-elevated`. `--negative` is left for value and error |
| `Dialog` and `AlertDialog` header and title with different spacing and line height; `leading-none` overlapped a title broken into two lines on mobile | the same `space-y-1.5` and `leading-tight tracking-tight` on both; `AlertDialogCancel` lost its `mt-2`, which added to the footer's `gap-2` on mobile only |
| Action buttons with `h-9` overridden on the default size, beside `size="sm"` with different padding; the authentication submit with `p-6` over `h-10` | `size="sm"` on every 36 px action and `size="lg"` on the sign-in and sign-up submit |
| `align-center`, a class that does not exist, in `(public)/layout.tsx` and in the two authentication forms, alongside `flex-col` with no `flex` | removed, with no layout change |
| The public footer's authorship link had no focus indicator (F1) | a `focus-visible:` ring and hover |
| `pagination.tsx`, `CardTitle`, `CardDescription` and fourteen parts of `dropdown-menu`/`select` with no consumer | removed |

`lucide-react` 1.x icons already come out with `aria-hidden="true"` when they
receive no `aria-*`, `role` or `title` (`buildLucideIconNode`); the explicit
`aria-hidden` the code carries is redundant, not missing, and what S6 requires
is still the `aria-label` of the icon-only control.

### Focus and pagination

| Finding | Fix |
| --- | --- |
| Four identical pagination `nav`s, copied in `positions-summary.tsx`, `positions-table.tsx`, `asset-transactions.tsx` and `portfolios/page.tsx` | `PageNavigation` in `components/page-navigation.tsx` |
| "Next" on the second-to-last page and "Previous" on the second became `disabled` with focus on them: the browser dropped focus on the `body` and the next `Tab` restarted from the top (F4) | `aria-disabled` on the end buttons, which stay focusable, are read as unavailable and ignore activation |
| Deleting the list's last transaction, or the last one on a page, swapped the table for the empty state and unmounted along with it the element that would receive focus (TD-052, F4) | `QuerySection` focuses the section's `<h2>` when the displayed content changes and focus, which was in the section or in a dialog opened from it, fell to the `body`; focus elsewhere on the page is not touched |
| A dialog opened from a menu item returned focus to an item already unmounted (TD-066, F3) | `useFocusReturn` records the menu's trigger, through the `aria-labelledby` Radix puts on the content with the trigger's id |
| The positions "Refresh" and both "Sign out" became `disabled` while fetching or signing out: activated from the keyboard, they dropped focus on the `body`, where it stayed after a failure (F4, 2.4.3) | `aria-disabled` with the click ignored while the action runs, like `SubmitButton` |

### Forms and account

| Finding | Fix |
| --- | --- |
| The API's error on sign-in and sign-up — invalid credential, email already registered, attempt limit — appeared in a toast only (N4, 3.3.1) | a `role="alert"` alert in the form, as in the dialogs; sign-up's `409` goes to the email field, with focus; the error toasts left `useSignIn` and `useSignUp` |
| Sign-in and sign-up disabled each field during submission, and Enter in a field disabled it with focus on it — the same defect as the `fieldset disabled` already fixed in the dialogs (F4) | the fields stay enabled; what prevents resubmission is the button |
| Every form's submit became `disabled` during submission: activated from the keyboard, it lost focus to the `body`, and the next `Tab` after a refused submission restarted from the top (F4, 2.4.3) | `SubmitButton`, with `aria-disabled` and the click cancelled while sending, which also cancels implicit submission by Enter in a field |
| Account screen: name and email in a `disabled` `Input`, out of the `Tab` order and announced as unavailable fields, and a password form that accepted typing beside an always-disabled "Update", with no route to serve it | an editable name and the email as text in a definition list; a password change with current password, new one and confirmation, through the new `PATCH /api/v1/user`. A wrong current password goes to its own field, with focus, and the section's description warns that the change ends the session |
| The password policy only appeared after the error (3.3.2) | a hint with the requirements linked through `aria-describedby` to sign-up's password and to the account's new password; today it is the `PasswordRequirements` list. On the account screen it checks off each requirement met and states it in text; on sign-up it only lists the requirements, because there the password is judged on submit |
| Sign-in and sign-up validated on `onChange`, with an error on every keystroke before the field was left | `onTouched`, as in the dialogs. Reverted on 2026-09-23 at the user's request: every form validates on `onChange`, so that a field only shows an error after receiving a value, and not when left empty. The error follows every keystroke, but it is not a live region — it reaches the screen reader through the field's `aria-describedby` — so it is not announced on every keystroke. On 2026-09-24, also at the user's request, the sign-in and sign-up password fields moved to validating on submit only (on sign-up, when the step advances), with no revalidation while typing, so that the layout does not move during typing. An invalid submission focuses the first field with an error, which carries `aria-invalid` and the message in `aria-describedby` |
| "Login", "Register", "Login instead", "Logged in as", "Logged out successfully" and two toasts on sign-up, beside "Sign out" in the menu | "Sign in", "Create account", "Sign in instead", "Signed in as", "Signed out" and a single toast; an account with no name is greeted by its email; the page titles, "Sign In" and "Sign Up", became "Sign in" and "Create account" |

The proxy's contract was exercised with `curl` against the local `compose`: a
name saved with the cookie kept, a wrong current password in `400` `VALIDATION`
with no `details`, a short new password in `400` with `path` `newPassword`, an
invalid body in a `400` from the proxy, the change accepted with a `Set-Cookie`
clearing `ex3:token`, the following `GET /api/v1/user` in `401`, sign-in with
the old password refused and with the new one accepted.

### Deletions

| Finding | Fix |
| --- | --- |
| Asset deletion closed the dialog on click, with no pending state: a second click resent the `DELETE`, which answered `404`, and the failure appeared in a toast only (TD-064, N4, 3.3.1) | `ConfirmDeletionDialog`, the dialog of all three deletions: it stays open until the deletion finishes, without closing on "Cancel", `Esc` or an outside click while it runs, and shows the refusal in an alert inside the dialog itself; the error toast left `useDeleteAsset` |
| The confirm button of the transaction and portfolio deletions became `disabled` during the deletion and dropped focus on the `body`, where it stayed after a refusal (F4, 2.4.3) | confirm with `aria-disabled` and the click ignored while deleting, like `SubmitButton` |
| After deleting an asset, focus on "Add asset" was requested while the dialog was still open, and the `FocusScope` returned it to the dialog; the return to the deleted row's menu trigger fell to the `body` (F4) | the page waits for the dialog to unmount before focusing "Add asset", as the portfolios page does with "New portfolio" |
| "Confirm" and "Are you sure you want to delete…" on the asset, against "Delete transaction" and "Delete portfolio" on the other two | "Delete asset" and "Delete {symbol}?", with the consequence in the description |
| With a single portfolio, "Delete" was `disabled`, out of the `Tab` order, and the explanation below the list was not linked to it (1.3.1, 4.1.2) | `aria-disabled`, focusable and with `aria-describedby` pointing at the explanation |
| `?action=delete` with no `symbol` opened the confirmation for "Unknown", with confirm disabled | ignored, like `add-transaction` with no `symbol` |

### Session and direct access

| Finding | Fix |
| --- | --- |
| A session that expired mid-use reloaded the page at sign-in, and the "Session expired" toast was lost in the reload: the form appeared without explaining why the user was signed out (N4, 3.3.1) | `reason=session-expired` in the sign-in URL, from the interceptor and from the proxy, and a notice above the form |
| A direct link to a protected route with no session, or a session that expired on a deep screen, ended at the Overview after sign-in, and the user retraced the path | sign-in returns to the requested path and query, in `next`, accepted only as a path of this origin |
| Closing any dialog on the assets screen pushed onto the history an entry identical to the current one, and Back appeared to do nothing; opened from a link, such as the Overview's "Add asset", the closed dialog reopened on Back | dialog parameters written with `history.replaceState` |
| A refresh or a shared link reset the performance chart to `1Y` and the portfolios, the Overview's positions and the asset's transactions to the first page | period and page in the URL, pushed on every change so that Back undoes it, as in the positions table |

### Tables

| Finding | Fix |
| --- | --- |
| The Overview's positions and the transaction tables had no caption, unlike the assets screen's positions, the allocation and the performance: the screen reader announced a table with no name (1.3.1) | an `sr-only` `TableCaption` on all of them: "Positions valued in {currency}" and "Transactions, newest first" |
| No table had a row header: going down a column of values, the screen reader read only the number, without the asset, the group or the date it belongs to (1.3.1) | `TableRowHeader`, `th scope="row"`, in the first cell of the five tables |

### Stale data

| Finding | Fix |
| --- | --- |
| Only the portfolio's value warned when the new fetch failed and the displayed value came from the cache; the Overview's other sections, the asset detail and the positions table showed the previous values as current (TD-024, N2, 4.1.3) | `StaleState` with a retry in `QuerySection`, above every section's content, and in the positions table, with the same message (`STALE_DATA_MESSAGE`) |
