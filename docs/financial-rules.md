# Financial rules

The mathematical definition of every number the API reports, with the point in
the code that implements it. What the entities mean is in
[`domain-model.md`](domain-model.md); here is how the values are computed from
them.

## Conventions

All arithmetic uses base-10 decimal (`Prisma.Decimal`), never binary floating
point. The monetary columns are `DECIMAL(38,18)`: 38 digits of precision, a
scale of 18 places.

* **Truncation.** Every exposed result is truncated **toward zero** at the
  column's scale (18 places). Nothing is ever rounded up: a displayed value is
  never greater than the computed one.
* **Intermediate precision.** The ledger replay computes with
  `2 × 38 + 1 = 77` digits and the valuation with `4 × 38 = 152`, enough that no
  intermediate operation rounds before the final truncation.
* **Percentages are fractions.** `profitLossPercent = 0.1` means 10%.
  Formatting as a percentage is the frontend's job.
* **An absent field ≠ zero.** When the quote or the exchange rate is missing, or
  the divisor is zero, the field **does not come in the body** — the response is
  still `200`. A zero would assert that the value is zero; the absence asserts
  that it is not computable right now.
* **Input in the web.** The web never converts a quantity or a value to
  `number`: the form holds the decimal string the API receives, and what it
  computes counts units of `10^-scale` in a `bigint`
  (`web/src/lib/decimal.ts`). The places per instrument class
  (`UNIT_PRICE_DECIMALS`) only define how the price is typed; the API accepts 18
  places in any class, so nothing the web sends is refused for precision and
  nothing stored loses places when edited.
* **Currencies.** A ledger lives in a single currency. Portfolio totals are
  converted to the portfolio's `baseCurrency` at each currency's most recent
  quote, not at the quote of each transaction's day.

Notation: `q` quantity, `p` unit price, `f` fees, `t` taxes, `P` market price,
`c` average cost, `x` exchange rate to the base currency.

## Average cost (`averageCost`)

The average cost per unit, rebuilt from the whole ledger on every write — never
incremented over the previous value. Entries are ordered by `executedAt` and, on
a tie, by the write order (`sequence`).

Initial state `q₀ = 0`, `c₀ = 0`. For each entry `i`:

```text
BUY, BONUS   qᵢ = qᵢ₋₁ + q
             total cost = qᵢ₋₁ · cᵢ₋₁ + q · p + f + t
             cᵢ = ⌊total cost · 10¹⁸ ÷ qᵢ⌋ ÷ 10¹⁸      (integer division)
SELL         qᵢ = qᵢ₋₁ − q,  refused if q > qᵢ₋₁
             cᵢ = cᵢ₋₁, and 0 when qᵢ = 0
DIVIDEND, JCP, INTEREST
             qᵢ = qᵢ₋₁,  cᵢ = cᵢ₋₁
```

A sale does **not** change the average cost: realizing a result does not change
the cost of what remains in the portfolio. Zeroing the position zeroes the cost,
so that a later repurchase does not inherit the previous position's cost.
`BONUS` enters with the cost attributed to each unit — a bonus with `p = 0`
dilutes the average cost, which is the correct effect.

An intermediate position that does not fit in `DECIMAL(38,18)` is refused with
`422`, with nothing written: the ledger does not pass through a state the column
cannot represent.

`backend/src/domain/PositionLedger.ts`

## Cost (`investedValue`)

```text
investedValue = ⌊q · c⌋₁₈
```

What the position cost, in the ledger's currency, truncated at the column's
scale. It is the denominator of the percentage result and the `investedValue` of
the overview, converted to the base currency.

## Valuation

A position's market value, in the quote's currency:

```text
marketValue = ⌊q · P⌋₁₈
```

In the portfolio's base currency, each part is converted at its currency's most
recent quote:

```text
marketValueBase   = ⌊q · P · x_quote⌋₁₈
investedValueBase = ⌊investedValue · x_ledger⌋₁₈
totalValue = Σ marketValueBase, over the positions with units
```

`totalValue` only exists if **every** position with units has a quote and an
exchange rate; a partial one would report a smaller portfolio as if it had lost
value. `quotedAt` is the **earliest** instant among the quotes and exchange
rates used: it describes the age of the total, not of the last query.

`backend/src/domain/PositionValuation.ts`,
`backend/src/domain/PortfolioValuation.ts`

## P&L

```text
profitLoss        = marketValue − investedValue
profitLossPercent = profitLoss ÷ investedValue          (absent if investedValue = 0)
```

On a position, the result is only given when the ledger's currency is the same
as the quote's — costs in different currencies do not add without an exchange
rate. On the portfolio, both are already in the base currency, and the result is
the difference of the two totals. A known effect: because both parts use today's
rate, the result does **not** separate what came from the asset's price from
what came from the exchange rate.

The day's change:

```text
dayChange        = totalValue − previousValue
dayChangePercent = dayChange ÷ previousValue            (absent if previousValue = 0)
```

`previousValue` is the portfolio valued at each asset's previous close, and it
only exists when every position with units has a previous close.

## Allocation

```text
allocation(position) = marketValueBase ÷ totalValue     (absent if totalValue is absent or 0)
allocation(group)    = Σ allocation of the group's positions
marketValue(group)   = Σ marketValueBase of the group's positions
```

The groups (`byAsset`, `byType`, `bySector`, `byCurrency`) add exactly the
positions' parts, without recomputing from the total: the four distributions
close at the same value. A group in which some position lacks the value leaves
the field out. Only positions with units enter. For `n` positions, the sum falls
below `totalValue` by less than `n · 10⁻¹⁸`, and below 1 by less than
`n · 10⁻¹⁸ · (1 + 1 ÷ totalValue)` — a truncation residue, not a rounding error.

`allocatePortfolio`, in `backend/src/domain/PortfolioValuation.ts`

## Performance

The daily series of the portfolio's value in the base currency. The window ends
at the start of the current day in UTC, exclusive, and starts at:

| `range` | Start |
| --- | --- |
| `1W`, `1M`, `3M`, `6M`, `1Y` | the same instant, 7 days / 1, 3, 6, 12 months earlier |
| `YTD` | 1 January of the current year, in UTC |
| `MAX` | the day of the ledger's first transaction |

A day becomes a point of the series only when every position held on it, and
every transaction executed on it, has a close and an exchange rate. Each day's
position is rebuilt from the ledger up to that day's close, so a transaction
entered retroactively moves the whole series before it.

Each entry's cash flow, in the base currency of the day:

```text
BUY                        +(q · p + f + t)        contribution
BONUS                      +(f + t)
SELL                       −(q · p − f − t)        withdrawal
DIVIDEND, JCP, INTEREST    −(q · p − f − t)        distribution
netContribution(day) = Σ of the flows of the entries executed on that day
```

The time-weighted return, chained from the first point:

```text
growth₁ = 1
growthᵢ = growthᵢ₋₁ · (valueᵢ − netContributionᵢ) ÷ valueᵢ₋₁      (valueᵢ₋₁ ≠ 0)
twrᵢ    = growthᵢ − 1
```

Subtracting the day's contribution before dividing is what keeps money put in or
taken out from counting as a gain. An interval with no points makes the
following return span the whole interval. `twr` is a fraction: `0.1` is 10%.

`trackPortfolioPerformance`, in `backend/src/domain/PortfolioPerformance.ts`

## Dividends

`DIVIDEND`, `JCP` and `INTEREST` are recorded in the ledger like any
transaction: `q` is the number of units that generated the income, `p` the gross
amount per unit, and the net received is `q · p − f − t`. Income does not
require units held on the date, because someone who sells after the entitlement
date still receives it. Two rules:

1. **They do not change the position.** Quantity and average cost stay as they
   were — income is not cost, and it cannot dilute or inflate the cost of
   whoever received it.
2. **They count as a distribution in the performance.** They enter the day's
   `netContribution` with the net amount negated, like a withdrawal — there is
   no cash balance in the portfolio, so income leaves it as a sale's net amount
   does. Because the asset's price drops on the ex date, that day's `twr` is
   `(value + income) ÷ the previous value`: the income does not appear as a
   loss.

A position's income is summed in
`GET /v1/portfolio/positions/:symbol/indicators` (see Position indicators,
below). For the portfolio there is no aggregation: no route returns a monthly
total, a yearly total or the whole portfolio's `yield` (TD-062 in
[`../TODO.md`](../TODO.md)).

## Position indicators

`GET /v1/portfolio/positions/:symbol/indicators` describes a position through
two groups, each absent when there is nothing to compute it from.

**Price (`prices`)**, from the instrument's daily closes, in the currency it is
quoted in. Read from 14 days before the start of the one-year window up to the
start of the current day in UTC, exclusive; the 14 days find the close that
prices a first day that fell on a weekend or a holiday (an assumed limit, not
measured: no market in the catalog goes two weeks without a trading session).
Absent when there is no close in the last year.

```text
close, closedOn      = the most recent close and its day
yearLow, yearHigh    = the lowest and highest close of the last year (closes, not intraday prices)
change(window)       = close ÷ opening − 1
opening              = the last close on or before the window's first day
openedOn(window)     = the opening's day, present only with change
closes               = one close per day, from the 1Y opening, or from the first close, to the most recent
```

The windows are `1M`, `3M`, `6M`, `YTD` and `1Y`, with the starts in
Performance, above. A window's change goes without `change` when the history
does not reach its first day, when the most recent close is not later than it,
or when the opening is zero.

A day observed by more than one source has more than one close (TD-028); every
price indicator reads only the most recent of each day, by instant order, the
same one the opening already read. `closes` is the series the asset detail's
price chart draws: it starts at the longest window's opening, so it contains
each window's, and the web cuts a window out from its `openedOn`, with no
calculation.

**Return (`returns`)**, from the position's ledger executed up to the instant of
the request, in the ledger's currency. Absent when there is no transaction.

```text
realizedProfitLoss = Σ over the sales of (q · p − f − t − q · c)  c = average cost before the sale
income             = Σ over the income entries of (q · p − f − t)
trailingIncome     = the same, only for those executed in the last year
yieldOnCost        = trailingIncome ÷ investedValue               (absent if investedValue = 0)
since              = the ledger's earliest executedAt
```

Each sale's result is truncated at 18 places before the sum, and the average
cost is the one from `rebuildPosition`'s replay, the same the position stores. A
stored ledger always rebuilds, because every write rebuilt it; a refusal here is
a broken invariant and answers `500`. There is no total return: adding the
position's unrealized result would require the quote in the ledger's currency,
the same restriction as P&L, above.

`describePositionIndicators`, in `backend/src/domain/PositionIndicators.ts`, and
`realizeProfitLoss`, in `backend/src/domain/PositionLedger.ts`

## Fundamentals

`GET /v1/portfolio/positions/:symbol/fundamentals` describes a position's
instrument through the fundamental indicators its class supports. None is
computed here: each value is what the market data source reports, and the
response says which source it is, in `source`, because another source may
compute the same indicator differently (window, adjustment, currency). The web
states that in the section's footer.

| Class | Indicators, in display order |
| --- | --- |
| `STOCK` | P/E, dividend yield (12M), ROE, profit margin, debt/equity, revenue growth, earnings growth, free cash flow (12M) |
| `REIT` | dividend yield (12M), debt/equity, revenue growth |
| `ETF`, `FUND` | dividend yield (12M) |
| `CRYPTO`, `BOND`, `TREASURY`, `CASH`, `OTHER` | none: `not-applicable`, with no query to the provider |

* REIT: property depreciation distorts earnings, so P/E, ROE, margin and
  earnings growth read the class poorly (the usual multiple is over FFO, which
  the source does not report).
* ETF and fund: the multiples would be those of the fund's portfolio, not of the
  fund itself; only the yield belongs to the fund.
* Generic "growth" is represented by revenue and earnings growth, which say what
  is growing.

```text
priceToEarnings = price ÷ earnings per share over the last 12 months (multiple)
dividendYield   = income paid over the last 12 months ÷ price (fraction)
returnOnEquity  = net income over the last 12 months ÷ shareholders' equity (fraction)
profitMargin    = net income ÷ revenue, last 12 months (fraction)
debtToEquity    = total debt ÷ shareholders' equity, last quarter (multiple)
revenueGrowth   = last quarter's revenue ÷ that of the same quarter a year earlier − 1 (fraction)
earningsGrowth  = last quarter's earnings ÷ those of the same quarter a year earlier − 1 (fraction)
freeCashFlow    = cash generated over the last 12 months after investments and interest (value, in the statements' currency)
```

Fractions come as `0.12` for 12%, multiples as `1.5` for 1.5 times, and the web
shows them as a percentage and as `1.50×`; the growth figures carry sign and
colour. Free cash flow comes with `currency`, the statements' currency, which
may differ from the quote currency, and is shown abbreviated (`R$9B`). Each
`figures[i]` without a `value` is an indicator the source does not report for
the instrument, displayed as "Not reported"; P/E with negative earnings usually
lands here.

| `outcome` | Meaning | Web |
| --- | --- | --- |
| `reported` | the source answered; `figures` carries one item per indicator of the class | the grid, with an `InfoTip` per indicator |
| `not-applicable` | the class supports no indicator | "Company fundamentals do not apply to this asset's class" |
| `not-found` | the source does not know the instrument, or it has no market to be translated | "The market data source has no fundamentals for this asset" |
| `unavailable` | the source failed or has no key | an error with a retry |

`fundamentalMetricsOf` and `describeFundamentals`, in
`backend/src/domain/Fundamentals.ts`

## Benchmarks

An optional comparison series in `GET /v1/portfolio/performance`, by catalog
symbol:

```text
twr(day) = close(day) ÷ close(window's first day) − 1
```

It is a pure price return: it does not reinvest the index's income and does not
convert currency — the series comes with the `currency` the benchmark is quoted
in, and it falls to whoever reads it not to compare different currencies without
a caveat. Empty when the first close is zero or the window has no close.

`returnsOf`, in `backend/src/domain/PortfolioPerformance.ts`

## Drawdown and risk metrics

**Not implemented.** No route returns `maxDrawdown`, `currentDrawdown`,
`recovery`, volatility, Sharpe, beta or correlation, and there is no domain
function that computes them (TD-063 in [`../TODO.md`](../TODO.md)). The series
of `GET /v1/portfolio/performance` is the input those numbers would need, and no
web screen displays a risk measure.

## What these definitions do not do

* **There is no per-lot cost.** The average cost is weighted over the whole
  position; FIFO, LIFO and specific cost are not options.
* **The realized result does not enter P&L.** `profitLoss` is always the
  unrealized result of what is still held; each position's realized result
  appears only in its indicators, and the portfolio does not add it up.
* **There is no separate exchange-rate effect.** See P&L, above.
* **There is no assessed tax.** `taxes` is the amount entered in the
  transaction, added to the cost; there is no tax rule, rate or period
  assessment.
* **There is no intraday price in the series.** Performance uses the daily
  close; the overview and the positions use the provider's latest quote, with a
  60s cache.
