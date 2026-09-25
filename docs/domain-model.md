# Domain model

The conceptual contract of the investment domain: what each entity represents,
who owns it, where its values come from and what it is not. The Prisma schema,
the services and the API follow this document; a divergence between them and the
document is a defect on one of the two sides and is resolved explicitly.

The mathematical definition of each metric derived from these entities —
average cost, cost, P&L, allocation, performance, income and benchmarks — is in
[`financial-rules.md`](financial-rules.md).

## Entities

```text
User
 └── Portfolio ─┬── Transaction ──► Instrument ◄── MarketQuote
                └── Position ─────► Instrument
```

| Entity | Responsibility | Owner | Identity |
| --- | --- | --- | --- |
| `User` | Identity, credentials and session. | — | `id`; unique `email` |
| `Portfolio` | Groups a user's ledger and positions under a base currency. It is the access boundary: every financial resource is resolved through the authenticated user's portfolio. | a `User`, who may have several | `id`; unique `(userId, nameKey)` |
| `Instrument` | The tradable market asset: stock, ETF, fund, REIT, crypto, bond, cash. From the global catalog, shared by every user, or private to whoever registered it. | none in the catalog; a `User` when private | `(ownerId, symbol)`, with the catalog counted as a single owner |
| `Transaction` | A financial event of a portfolio over an instrument. The source of truth of every movement. | a `Portfolio` | `id` |
| `Position` | How much of an instrument a portfolio holds and at what cost. A projection derived from the transactions, never edited directly. | a `Portfolio` | `(portfolioId, instrumentId)` |
| `MarketQuote` | The close of one trading day of an instrument, with currency and source. | — | `(instrumentId, timestamp, source)`, with `timestamp` at the start of the day in UTC |

## Portfolio

Every account has at least one portfolio: sign-up creates the first, with the
name registration gives it or `Main`, and deleting the last one answers `422`.
Deleting a portfolio removes its positions and transactions in the same
serializable transaction; the instruments stay registered. `name` changes at any
time, and `baseCurrency` only while the portfolio has no transaction (`422`),
because the web records a new transaction in the base currency and a position
already open in another currency would refuse the write
(`CURRENCY_MISMATCH`). There is no cap on portfolios per account (TD-011).

**A name unique per owner.** The name is stored normalized by
`normalizePortfolioName` (`backend/src/domain/PortfolioName.ts`): NFC form, each
run of spaces becomes one space, no surrounding spaces; the typed case is kept.
`nameKey`, the normalized name in lowercase (`portfolioNameKey`), is unique per
`userId`: two names that differ only in case or spacing are the same name to the
owner, and different users may repeat names. The unique index is the only
authority — of simultaneous creations or renames with the same name, exactly one
passes — and the violation becomes a `409` with `details` on `name`. Renaming to
one's own name in another case keeps the key and passes. Before sending, the web
checks the names of the portfolios the screen loaded and those the API has
already refused in the open dialog; the rest only the API knows.

**Active portfolio.** The web operates one portfolio at a time: the one chosen
on the portfolios screen, kept in the browser's `localStorage`
(`ex3:active-portfolio`), or the oldest while no choice exists. A choice the API
no longer resolves, because the portfolio was deleted or belongs to another
account, is discarded, and sign-out clears it. The choice is a display
preference only: the API resolves each portfolio through the authenticated user.

## Instrument catalog

An instrument belongs to the catalog, with no owner and shared by every
portfolio, or is private, with `ownerId` on the user who registered it and
visible to them alone. Deleting the account of someone who holds a catalog
instrument keeps the instrument; deleting the account of a private instrument's
owner removes the instrument and its quote series in the same transaction.

| Field | Rule |
| --- | --- |
| `symbol` | identity, unique per scope and never changed; a new symbol accepts letters and digits only, up to 6 characters |
| `name` | up to 120 characters |
| `type` | `STOCK`, `ETF`, `FUND`, `REIT`, `CRYPTO`, `BOND`, `TREASURY`, `CASH` or `OTHER` |
| `market` | trading market: `B3`, `NYSE`, `NASDAQ` or `CRYPTO`, the ones the quote provider prices |
| `currency` | quote currency, ISO 4217 code; the market's, when the market quotes in a single one |
| `sector` | optional, up to 60 characters |
| `country` | optional, two-letter code |

**Identity.** For each user, a symbol names a single instrument: their private
one, if it exists, otherwise the catalog's. The unique index `(ownerId, symbol)`
is the only authority over this and is created with `NULLS NOT DISTINCT`, which
Prisma does not declare: without it each catalog row, with a null `ownerId`,
would be distinct from the others and the catalog could repeat a symbol. Of
simultaneous registrations of the same symbol, exactly one writes. The market
does not enter the identity, because the asset, position and transaction routes
address the instrument by symbol; the same ticker in two markets is TD-067.

**Market currency.** `B3` quotes in `BRL`, `NYSE` and `NASDAQ` in `USD`, and
`CRYPTO` in the currency registration chooses, because the pair requested from
the provider carries it. Registration or a correction in another currency
answers `422` (`CURRENCY_MISMATCH`), since the instrument would be valued in the
wrong currency; an instrument migrated without `market` or `currency` is not
restricted.

**Who writes.** Only an admin registers and corrects catalog instruments; a
write to the catalog by another user receives 403. Any authenticated user
registers a private instrument when opening the asset (`POST /v1/assets/create`
with `listing`), from what the quote provider lists under the symbol in the
chosen market and currency: name, class and sector never come from the client.
Only the owner corrects it. Registration refuses with `409` a symbol the catalog
already has (`ALREADY_EXISTS`), because the asset should come from the catalog,
and one the user has already registered (`PRIVATE_ALREADY_EXISTS`). Another
user's private instrument is invisible: listing it, opening it as an asset or
correcting it answers as a non-existent symbol, 404. The web adds an asset
through a single search: the instruments the user already sees, with the
*Private* badge on their own, and the provider's listings under the term as a
ticker, with the *New* badge.

**Private instrument and catalog.** A private instrument whose symbol an admin
later registers in the catalog stays with its owner and hides the catalog's from
them, with the same series and the same positions; the catalog does not absorb
private instruments.

**One position per instrument.** A portfolio has at most one position per
instrument, and several portfolios may hold a position in the same instrument.
Transactions reference the portfolio and the instrument.

**Data predating the catalog.** The migration created one instrument per
existing symbol, with `name` equal to the symbol, type `OTHER` and the remaining
fields empty. That is why `market` and `currency` are optional in the database
although mandatory on registration, and it falls to an admin to complete those
instruments before any calculation that depends on the currency. Symbols stored
before the allowlist (e.g. `BRK.B`) remain in the catalog and in the portfolios
that held them, but they cannot be opened in another portfolio or registered
again. The migration aborts without changing anything if a transaction exists
with no corresponding asset.

## Transaction

Every transaction belongs to a portfolio and references an instrument; the
position it moves is that of `(portfolioId, instrumentId)`.

| Field | Rule |
| --- | --- |
| `type` | one of the types in [Effect of each type](#effect-of-each-type) |
| `quantity`, `unitPrice` | positive decimals, stored separately; `unitPrice` may be zero in a `BONUS` |
| `fees`, `taxes` | non-negative decimals; zero when not given |
| `currency` | the operation's currency, ISO 4217 code |
| `executedAt` | when the operation happened, with time zone; mandatory and independent of `createdAt` |
| `broker` | optional, up to 60 characters |
| `notes` | optional, up to 500 characters |

**Income and bonus.** `DIVIDEND`, `JCP` and `INTEREST` record the income the
position pays: `quantity` is the number of units that generated it, `unitPrice`
the gross amount per unit, `taxes` the tax withheld and `fees` the charges, and
the net received is `quantity × unitPrice − fees − taxes`. Income does not
require units held on the date, because someone who sells after the entitlement
date still receives it. `BONUS` records the units received as a bonus, and
`unitPrice` is the cost attributed to each one, zero when there is none.

**One currency per position.** The transaction's currency need not be the
portfolio's base currency, but every transaction of a position uses the same
one, because average cost only adds amounts in the same currency. A transaction
in another currency is refused without writing anything.

**Data predating the transaction.** The migration renamed `amount` and `price`
to `quantity` and `unitPrice` and converted each `double` through the shortest
decimal representation that reproduces it, which is the value the API used to
return. Existing rows received `fees` and `taxes` of zero, `currency` equal to
the portfolio's base currency and `executedAt = createdAt`, and the positions
were rebuilt in decimal arithmetic. It aborts without changing anything if a
transaction exists with a type outside the list, with no portfolio, or with a
non-positive `amount` or `price` or one that `DECIMAL(38,18)` does not hold
without rounding; or if some ledger sells more than it holds, contains a type
the rebuild does not implement, or passes through a position outside
`DECIMAL(38,18)`.

## Ledger and position

The position is a function of the portfolio's transactions on that instrument,
and of those alone: the same sequence of transactions always produces the same
`quantity`, the same `averageCost` and the same `investedValue`. Creating,
editing or deleting a transaction rebuilds the position and writes both in a
single database transaction.

The ledger's order is `executedAt`, then the write order, the `sequence` the
database assigns to each transaction. A transaction not yet stored comes after
the stored ones with the same `executedAt`. The rebuild sorts the ledger it
receives, so the order in which the transactions reach it does not change the
result.

**Data predating the position.** The migration that renamed `assets` to
`positions` rebuilt each position's `quantity`, `averageCost` and `balance` from
its transactions, in `createdAt`, `id` order, and replaced the stored value when
it diverged. It aborts without changing anything if some position's ledger sells
more than it holds. The migration that created `sequence` numbered the existing
transactions in `createdAt`, `id` order, the same one the ledger followed until
then, and no position changed. The migration that created `investedValue`
renamed `balance` and wrote `quantity × averageCost` into each position,
truncated at 18 places; it aborts without changing anything if any of those
products does not fit in `DECIMAL(38,18)`.

### Cost

* `investedValue = quantity × averageCost`, the cost of the units held, written
  into the position by the rebuild along with `quantity` and `averageCost`. The
  amount received in a sale does not enter it.
* **Weighted average cost.** A purchase adds to the quantity and to the total
  cost (`quantity × unitPrice + fees + taxes`). A sale reduces the quantity and
  removes `quantity × averageCost` from the total cost, without changing the
  average cost; the difference between the sale's net amount and that cost is
  realized profit.
* The method is the one used to assess capital gains on variable income in
  Brazil and is the only one compatible with a position that stores quantity and
  average cost, with no lots.
* A sale above the quantity held is refused without writing anything.

### Effect of each type

| Type | Quantity | Total cost |
| --- | --- | --- |
| `BUY` | adds | adds `quantity × unitPrice + fees + taxes` |
| `SELL` | subtracts | subtracts `quantity × averageCost`; generates realized profit |
| `DIVIDEND`, `JCP`, `INTEREST` | unchanged | unchanged; it is income |
| `SPLIT` | changes by the split or reverse split | unchanged; the average cost adjusts |
| `BONUS` | adds | adds `quantity × unitPrice + fees + taxes`, with `unitPrice` the attributed cost |
| `TRANSFER_IN` | adds | adds the origin cost given |
| `TRANSFER_OUT` | subtracts | subtracts `quantity × averageCost`, with no realized profit |
| `DEPOSIT`, `WITHDRAWAL`, `ADJUSTMENT` | see open decisions | see open decisions |

The API only accepts a type once its effect is defined here and implemented in
the position rebuild. Today it accepts `BUY`, `SELL`, `DIVIDEND`, `JCP`,
`INTEREST` and `BONUS`; the rest exist in the schema and are refused with 400.

## Valuation

Valuation is not an entity. It is the computed result of a position against the
instrument's latest quote, at an instant:

| Result | Definition |
| --- | --- |
| `quote` | the provider's quote: `price`, `currency`, `timestamp` and `source` |
| `marketValue` | `quantity × price`, in the quote's currency |
| `profitLoss` | `marketValue − investedValue`; absent when the currency of the position's transactions is not the quote's, or the position has no transactions |
| `profitLossPercent` | `profitLoss ÷ investedValue`, as a fraction (`0.25` is 25%); absent when `profitLoss` is absent or `investedValue` is zero |

* `marketValue` and `profitLossPercent` are truncated toward zero at 18 places,
  and `profitLoss` is the exact difference.
* `investedValue` is in the currency of the position's transactions and
  `marketValue` in the quote's; in different currencies, comparing them would
  require a conversion (see
  [Values, currencies and dates](#values-currencies-and-dates)).
* An instrument with no quote and an unavailable provider arrive as `not-found`
  and `unavailable` on the asset, not as a request error.

None of this is stored as a source of truth, and the calculation stays in the
backend, in `backend/src/domain/PositionValuation.ts`: the frontend displays, it
does not calculate. `GET /v1/portfolio/positions` values a portfolio's
positions; the previous endpoint, `GET /v1/assets/valuations`, was removed
(TD-034).

### Portfolio overview

`GET /v1/portfolio/overview` consolidates a portfolio's positions in its
`baseCurrency`, in `backend/src/domain/PortfolioValuation.ts`:

| Indicator | Calculation |
| --- | --- |
| `heldPositionCount` | positions with units, always present: `0` separates the portfolio that holds nothing from the one that holds assets valued at zero |
| `totalValue` | the sum of `quantity × price × rate` of the quote's currency |
| `investedValue` | the sum of `investedValue × rate` of the transactions' currency |
| `profitLoss` | `totalValue − investedValue` |
| `profitLossPercent` | `profitLoss ÷ investedValue`, as a fraction |
| `dayChange` | `totalValue` minus the value at the previous close, the sum of `quantity × previousClose × rate` |
| `dayChangePercent` | `dayChange ÷` the value at the previous close, as a fraction |
| `quotedAt` | the earliest instant among the quotes of the positions with units and the rates of those quotes' currencies |

* The rate is the most recent exchange quote of the currency against the base,
  and 1 in the base itself. Every indicator uses the same rate, so neither the
  result nor the day's change reflects the exchange rate's movement (TD-022).
* An indicator is only returned when every position with units has what it uses:
  quote, currency rate and, in the day's change, `previousClose`. With something
  missing, it and whatever depends on it stay out of the response, with no
  error; a non-zero cost with no known currency leaves `investedValue` out.
* A position with no units enters neither the sum nor the query to the provider.
* A percentage with a zero base stays out. Totals and percentages are truncated
  toward zero at 18 places, and the differences are exact.
* A portfolio with no positions answers with totals of `0`, no percentages, and
  `heldPositionCount` `0`.
* `quotedAt` follows `totalValue`: it stays out when that does and when the
  portfolio has no position with units. A rate used by the cost alone, in the
  transactions' currency, does not enter. A quote the provider repeats after a
  failure (see Yahoo Finance) keeps the instant at which it was observed, so
  `quotedAt` may predate the query without the response indicating the failure.

### Portfolio positions

`GET /v1/portfolio/positions` lists a portfolio's positions in pages, with the
values in its `baseCurrency`, also in
`backend/src/domain/PortfolioValuation.ts`:

| Field | Calculation |
| --- | --- |
| `averageCost` | `averageCost × rate` of the transactions' currency |
| `marketPrice` | `price × rate` of the quote's currency |
| `marketValue` | `quantity × price × rate` of the quote's currency |
| `allocation` | `marketValue ÷ totalValue` of the overview, as a fraction |
| `profitLoss` | `marketValue − investedValue × rate` of the transactions' currency |
| `profitLossPercent` | `profitLoss ÷` the converted `investedValue`, as a fraction |

* The rate is the overview's, so no field reflects the exchange rate's movement
  (TD-022). A zero value needs no rate.
* A field whose input is missing stays out of the item, with no error: with no
  quote or no rate for the quote's currency, `marketPrice`, `marketValue`,
  `allocation` and the result go out; with no known currency or no rate for the
  transactions' currency, `averageCost` and the result go out.
* `allocation` is only emitted when the overview's `totalValue` exists and is
  not zero, so a position with units and no quote removes the allocation from
  every item.
* A position with no units is listed, with `marketValue` and `allocation` zero.
  The positions with units are quoted on every page, because the allocation
  depends on the total; the one with no units only when it is on the requested
  page or when the ordering is by a value.
* The default ordering is by `symbol`, ascending or descending, and does not
  depend on a quote, so a price change does not move a position between pages.
  By a value, the page is cut after valuing every position that matches the
  filters: a position without the value goes last in both directions, a tie
  follows the `symbol` order, and a price change may move a position between
  pages.
* `search` compares, case-insensitively, against `symbol` and `name`; `type`,
  against the instrument's class; and `status` separates the positions with
  units (`open`) from those without (`closed`). `total` and `totalPages` count
  the filtered positions only, and the allocation remains over the whole
  portfolio.
* Values and fractions are truncated toward zero at 18 places, and the result is
  the exact difference.

`GET /v1/portfolio/positions/:symbol` describes one position with
`describePosition`, in the same file:

* The value fields are those of the item above, computed the same way. The
  allocation remains over the whole portfolio, so describing one position also
  quotes every position with units.
* `type`, `market`, `currency` and `sector` come from the catalog. `quote`
  carries the current quote in the currency it was quoted in, with no
  conversion, and stays out of the body when there is no quote.
* `dayChange` is `price − previousClose`, and `dayChangePercent` is
  `dayChange ÷ previousClose`, as a fraction, both truncated toward zero at 18
  places. With no `previousClose` both go out; with it at zero, only the
  percentage does.

### Portfolio allocation

`GET /v1/portfolio/allocation` distributes a portfolio's value, in its
`baseCurrency`, by asset, type, sector and currency, also in
`backend/src/domain/PortfolioValuation.ts`:

| Distribution | Key of each group |
| --- | --- |
| `byAsset` | the instrument's `symbol` and `name`, in `symbol` order |
| `byType` | `Instrument.type` |
| `bySector` | `Instrument.sector`, `null` with no sector |
| `byCurrency` | the quote's currency, or `Instrument.currency` with no quote |

* Each group carries `marketValue` and `allocation`, the exact sum of the values
  its positions have in [Portfolio positions](#portfolio-positions), and
  `totalValue` is the overview's. The truncation difference is not redistributed
  among the groups.
* Only positions with units enter. A group with a position lacking `marketValue`
  or `allocation` goes without the field, with no error; with no `totalValue`,
  or with it zero, no group has `allocation`.
* Each position is truncated before the sum, so every distribution adds the same
  values, below the total by less than one unit of the scale per position: with
  n positions, `0 ≤ totalValue − Σ marketValue < n × 10⁻¹⁸` and
  `0 ≤ 1 − Σ allocation < n × 10⁻¹⁸ × (1 + 1 ÷ totalValue)`.
* The groups follow the key order by code unit, with `null` last. The
  distribution is not paginated.
* A portfolio with no positions with units answers `totalValue` `0` and empty
  distributions.

### Portfolio performance

`GET /v1/portfolio/performance` returns a portfolio's historical series, in its
`baseCurrency`, in `backend/src/domain/PortfolioPerformance.ts`. The other
valuation routes use the current quote; this one uses each day's close (see
[Stored quotes](#stored-quotes)).

| Window (`range`) | Starts at |
| --- | --- |
| `1W` | 7 days before the current day |
| `1M`, `3M`, `6M`, `1Y` | 1, 3, 6 or 12 months before the current day |
| `YTD` | the first day of the current year |
| `MAX` | the day of the ledger's first transaction; with no transaction, the window is empty |

* Every window ends at the start of the current day in UTC, exclusive, the first
  day that has no close yet, and starts at the start of a day. The same window
  requested twice on the same day answers with the same days, whatever the time
  zone of the caller.
* Each point carries `date`, `value`, `investedValue`, `netContribution` and
  `twr`. Each day's position is rebuilt from the ledger up to the end of that
  day, by the rules of [Ledger and position](#ledger-and-position), so a
  transaction recorded retroactively moves the whole series from its date
  onward.
* A day only becomes a point when every position held on it, and every
  transaction executed on it, has a close and an exchange rate to the base
  currency. A partial day would answer with a portfolio smaller than it is, as
  if it had lost value, so it stays out of the series.
* `netContribution` is the day's cash: `BUY` adds quantity × price plus fees and
  taxes, `SELL` and income subtract the net amount, and `BONUS` adds fees and
  taxes only, because the attributed cost is not money that came in. With no
  cash balance (see [Open decisions](#open-decisions)), income leaves the
  portfolio like a sale's net amount, so it counts as the return of the day it
  was paid. `twr` is the time-weighted return accumulated since the first point,
  chaining `(value − netContribution) ÷ the previous day's value`, so that money
  that came in or out on the day does not count as a gain. A gap in the series
  makes the following return span the gap.
* `benchmark` is optional and names a catalog symbol: the body gains
  `{ symbol, currency, series }`, each point with `close` and the `twr` over the
  window's first close, comparable with the portfolio's. The benchmark's return
  is that of the currency it is quoted in, with no conversion to the base
  currency (TD-030).
* `symbol` is optional and restricts the ledger to the transactions of that
  symbol's position in the portfolio, so value, contribution and return of the
  whole series are that position's alone. A symbol with no position in the
  portfolio answers `404`.
* A market index is not quotable today, because the catalog's symbol pattern
  refuses `^BVSP`, so the comparison is against an ETF that replicates the
  index, such as `BOVA11` or `IVV`.

## Quote source

The domain obtains prices through `MarketDataProvider`, in
`backend/src/domain/MarketDataProvider.ts`, without depending on any provider's
SDK or API. The implementations live in `backend/src/infra/market-data`, and
swapping them does not change the domain.

| Operation | Result |
| --- | --- |
| `getQuotes(instruments)` | the most recent price of each instrument, one entry per symbol requested |
| `getExchangeRates(currencies, baseCurrency)` | the price of one unit of each currency in `baseCurrency`, one entry per currency requested; a currency with no pair against the base, including the base itself, is `not-found` |
| `getHistoricalPrices(instrument, range, interval)` | the close of each `interval` (`5m`, `15m`, `30m`, `1h` or `1d`) from `range.from`, inclusive, to `range.to`, exclusive, in ascending `timestamp` order; `range-not-served` when the provider does not keep prices that old at that interval |
| `getHistoricalExchangeRate(currency, baseCurrency, range)` | the pair's daily close, one rate per traded day of `range`, on the terms `getExchangeRates` defines for the pair and `getHistoricalPrices` for the interval |

* Each price carries `price` as a decimal string, an explicit `currency`,
  `timestamp` as a UTC instant and `source`, the provider that observed it. The
  quote also carries `previousClose`, the previous close, when the provider has
  it.
* The instrument arrives with `symbol`, `market` and `currency` from the
  catalog; translating them into the provider's code is the implementation's
  job, and an instrument it does not translate is `not-found`.
* The provider's response is external input, and the implementation validates it
  before returning it.
* An instrument with no price at the provider (`not-found`) and a provider that
  does not answer (`unavailable`) are results, not exceptions.
* It is the backend that calls the provider: the web's CSP blocks a browser call
  to another domain, and the provider's credential does not leave the server.

### Yahoo Finance

`YahooFinanceProvider` queries the YH Finance API (`https://yfapi.net`) with the
`YAHOO_FINANCE_API_KEY` key in the `x-api-key` header alone, and refuses
redirects, so that the key does not follow to another destination. The variable
is optional: without it, the backend boots, warns in the log and every quote
answers `unavailable`, with no request.

| `market` | Provider code |
| --- | --- |
| `B3` | `{symbol}.SA` |
| `NYSE`, `NASDAQ` | `{symbol}` |
| `CRYPTO` | `{symbol}-{currency}` |

* An instrument with no `market` or `currency`, or with a symbol outside letters
  and digits, is `not-found` with no request, like the ones migrated before the
  catalog until they are completed.
* A quote with a currency that is not an exact ISO 4217 code, a non-positive
  price or one outside `DECIMAL(38,18)`, or with no time is not accepted: the
  symbol answers with the last quote received or `unavailable`, without
  affecting the others in the same request. Yahoo quotes some listings in a
  smaller unit, such as `GBp`, one hundredth of `GBP`.
* The price is rounded to the places of `priceHint`, reported by the provider,
  which discards the response's floating-point noise.
* Intervals below one hour reach the last 60 days, `1h` the last 730, and `1d`
  has no limit.
* An exchange rate is the pair `{currency}{baseCurrency}=X`, such as `USDBRL=X`,
  with the same cache, batching and pause as the quotes. A code outside three
  uppercase letters, or equal to the base currency, is `not-found` with no
  request, and a rate quoted in a currency other than the base is `unavailable`.
* `previousClose` comes from `regularMarketPreviousClose`, rounded like the
  price; an invalid value is discarded without refusing the quote.
* Quotes are cached in the process's memory for 60 seconds, including
  `not-found`. A symbol already being queried joins the request in flight, and
  the rest go in batches of 10 per request.
* Each request times out in 5 seconds. An error status, a timeout, a network
  failure or a response outside the format suspend the calls to the provider for
  30 seconds; on the failure and during the pause, each symbol answers with the
  last quote received, with the `timestamp` at which it was observed, or
  `unavailable` when there is no previous quote. The history does not use the
  quote cache.
* A history query identical to one in flight — same symbol, interval and window
  — joins the request in flight. A window the provider answered with no price,
  or with a 404, is answered the same way for one hour with no new request, up
  to 10,000 windows, discarding the oldest. A window with a price and a failure
  are not kept.
* The current quote is not stored; what the table keeps is the daily close (see
  [Stored quotes](#stored-quotes)).
* The listing search asks, in a single quote request, for the ticker in each
  market — `{symbol}.SA`, `{symbol}` and `{symbol}-{currency}` for `BRL`, `USD`
  and `EUR` — and accepts only the item whose exchange and currency confirm the
  requested market: `SAO` is `B3`; `NYQ`, `ASE` and `PCX` are `NYSE`; `NMS`,
  `NGM` and `NCM` are `NASDAQ`; `CCC` is `CRYPTO`. The class comes from
  `quoteType` (`EQUITY` is `STOCK`, `ETF` is `ETF`, `MUTUALFUND` is `FUND`,
  `CRYPTOCURRENCY` is `CRYPTO`), and a B3 stock with `FII` or `imobiliári` in
  the name is a `REIT`. The name is `longName`, else `shortName`, with the
  spaces collapsed and cut at 120 characters.
* The search is cached for one hour, up to 1,000 tickers, discarding the oldest;
  during a failure, it answers with the last search kept. A search failure
  pauses the provider as a quote failure does.
* The sector comes from
  `/v11/finance/quoteSummary/{symbol}?modules=assetProfile`, requested only when
  registering a `STOCK` or a `REIT`. A failure or a response outside the format
  leave the sector empty, record `quote_provider_request_failed` and do not
  pause the quotes.
* The fundamentals come from the same path, with only the modules of the
  requested indicators: `summaryDetail` (`trailingPE`;
  `trailingAnnualDividendYield`, or `yield` for a fund) and `financialData`
  (`returnOnEquity`, `profitMargins`, `debtToEquity`, `revenueGrowth`,
  `earningsGrowth`, `freeCashflow` in the `financialCurrency` currency). Each
  number is read as `{ raw }` or as a plain number; `{}` or an unreadable value
  leave that indicator alone without a value, and a cash flow with no ISO 4217
  currency stays out. `debtToEquity` comes as a percentage and is returned as a
  multiple. The response is cached for one hour, per symbol and modules,
  including the 404; a failure or a response outside the format answer
  `unavailable`, record `quote_provider_request_failed`, do not pause the quotes
  and are not cached. The field names follow the known `quoteSummary` format,
  with no check against the real provider (TD-079).

The timeout, cache, pause and batch values are assumed, not measured, and the
provider's plan quota and price were not verified (TD-020). The exchange map and
the REIT rule are also assumed (TD-074).

### Stored quotes

`MarketQuote` keeps the close of each trading day of an instrument, in the
`market_quotes` table. The series is filled by on-demand backfill from
`getHistoricalPrices`: no portfolio read stores a quote, and the current quote
still comes from the provider on every request, with the provider's cache.

| Field | Rule |
| --- | --- |
| `instrumentId` | the instrument, from the catalog or private; the series follows the instrument, not the symbol |
| `timestamp` | the start of the trading day in UTC, not the instant of the close |
| `price` | a decimal on the scale of the monetary columns, as the provider returned it |
| `currency` | the quote's currency, ISO 4217 code |
| `source` | the provider that observed the price, such as `yahoo-finance` |

* An instrument has at most one row per day and source, and the unique index
  `(instrumentId, timestamp, source)` is the only authority over this: storing a
  day already stored keeps the price first observed, and two simultaneous writes
  of the same day produce a single row.
* A close correction published by the provider does not replace the stored value
  (TD-027), and nothing discards an old row (TD-026).
* The stored price is the one the adapter has already validated (see
  [Yahoo Finance](#yahoo-finance)); the write does not revalidate.
* The table covers every instrument, and the performance series' benchmark is
  the instrument the symbol names for the user, with the same series. The
  exchange pair has a table of its own.

The series is queried by interval, from `from` inclusive to `to` exclusive, in
ascending day order. What the requested interval does not find stored is
requested from the provider at the daily interval and stored before the
response:

* Only the missing edges are requested: the stretch before the oldest close and
  the one after the newest. A day with no close between the extremes is a day on
  which the market did not trade, and it is not requested again.
* The current day in UTC is never requested, because it has no close yet;
  requesting it would spend a provider request on every read of the series.
* A provider that does not answer, or that does not keep prices that old at that
  interval, leaves the series with what is stored: an incomplete history is not
  a failed request.
* The query returns every source, so a day observed by two sources is two
  entries. Consuming the series without distinguishing the source is TD-028.

`ExchangeRate` keeps a currency pair's daily close, in the `exchange_rates`
table, by the same rules: one row per pair, day and source, `timestamp` at the
start of the day in UTC, `rate` on the scale of the monetary columns, and the
same edge backfill, from `getHistoricalExchangeRate`. The pair comes from
whoever stores it, not from the price: a rate is quoted in the base currency, so
the currency the price carries is the base. It is this series that brings a
position in a foreign currency into the base currency in
[Portfolio performance](#portfolio-performance); the current exchange rate of
the other routes still comes from the provider on every request, with no
storage.

## Values, currencies and dates

* Quantities and monetary values are exact decimals, never floating point:
  `DECIMAL(38,18)`, up to 20 integer digits and 18 places, in a transaction, a
  position and a stored quote. The API receives and returns them as a decimal
  string, and a value the column would round is refused, not rounded.
* The average cost is truncated at 18 places on each `BUY`, and `investedValue`
  once, at the end of the rebuild. A ledger that passes through a position
  outside `DECIMAL(38,18)`, `investedValue` included, is refused, even if the
  final position fits.
* Every monetary value has an explicit currency. `Instrument.currency` is the
  quote currency, `Transaction.currency` the operation's and
  `Portfolio.baseCurrency` the consolidation one.
* Values in different currencies only add through a conversion with an explicit
  exchange quote; with no quote, the total is not computed. The exchange quote
  comes from the quote provider, at the most recent rate (see
  [Portfolio overview](#portfolio-overview)).
* Instants are stored in UTC. `executedAt` is when the operation happened, given
  by whoever records it; `createdAt` and `updatedAt` are when the record was
  written and changed. The web records only the execution day, chosen in the
  browser's time zone, and sends the first instant that falls on that day in
  both the browser's zone and UTC, the later of the two midnights, so that the
  table and the performance series show the same day. Transactions of the same
  day follow in the ledger the order in which they were recorded (`sequence`); a
  transaction stored earlier with a time later than that instant comes after one
  recorded later with the day alone.

## Terms

| Term | Means | Does not mean |
| --- | --- | --- |
| asset | `Instrument` | someone's position in it |
| position | `Position` | the instrument, nor its market value |
| transaction | `Transaction`, the ledger's event | a database transaction, which is always called that |
| cost, invested value | `investedValue` | market value |
| market value | `marketValue`, computed | a stored value |

## Correspondence with the previous model

| Previous model | Domain model |
| --- | --- |
| `Asset` (a symbol's position in a portfolio) | `Position`, with the symbol extracted into `Instrument` |
| `Asset.symbol` unique across the whole database | `Instrument` unique; a position unique per portfolio and instrument |
| `Portfolio.userId` unique | several portfolios per user, each with a base currency |
| `Transaction.assetSymbol` | `portfolioId` and `instrumentId` |
| `amount`, `price` | `quantity`, `unitPrice` |
| `createdAt` as the operation's date | `executedAt`; in the migration, existing rows receive `executedAt = createdAt`, the only date they know |
| `balance` (accumulated `±amount × price`) | `investedValue`, the cost of the units held; in the migration, `quantity × averageCost` of each position. The current value is `marketValue` |
| `amount`, `price` and the position in `Float` | `DECIMAL(38,18)`, as a decimal string in the API |
| `type` as text, `BUY` or `SELL` | the `TransactionType` enum, with the types in [Effect of each type](#effect-of-each-type) |
| implicit currency | `Transaction.currency`; in the migration, the portfolio's base currency |

## Open decisions

* **Cash.** Whether a purchase and a sale move a portfolio's cash balance, which
  makes `DEPOSIT` and `WITHDRAWAL` a prerequisite for a purchase, or whether
  contributions and withdrawals are a record of flow alone.
* **`ADJUSTMENT`.** What may be adjusted and with what effect on quantity and
  cost.
