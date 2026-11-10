# Competitive benchmarking

What three investment trackers document about the patterns ex3 cares about, and
what ex3 took from each. Read on 2026-10-29 from the vendors' own pages; a claim
below is only what the page says, not something verified inside the product.

| Source | Page |
| --- | --- |
| Sharesight | <https://www.sharesight.com/investment-portfolio-performance/>, <https://help.sharesight.com/show_portfolio/> |
| Snowball Analytics | <https://help.snowball-analytics.com/features/> |
| getquin | <https://www.getquin.com/portfolio-tracker> (marketing copy) |

## What the references document

* **Return split into its sources (Sharesight).** The portfolio summary shows
  capital gain, income and currency gain apart, each in money and percent, and
  their sum as total return; each section has a short inline explanation with a
  link to the method. Capital gain is "either in unrealised profit or both
  realised and unrealised profit", a setting.
* **Benchmark as an index (Sharesight).** "Performance Index" rebases the
  portfolio and the benchmark to 10,000 points; any listed security can be the
  benchmark.
* **Received apart from forecast (Snowball).** Dividend history "is taken from
  the imported transactions"; forecasts and calendar entries are marked
  "Estimated", and the page warns that they can change.
* **Targets before rebalancing (Snowball).** Rebalancing suggestions start from
  "target allocations" the user sets for categories and holdings.
* **Overexposure (getquin).** An "X-ray" of stocks and ETFs to "identify
  potential overexposure", and splits by geography, industry and asset class.
* **Freshness.** None of the pages says how often prices refresh or what is
  shown when one is missing: Sharesight says only that the price is "the current
  price or the closing price of the selected end date".

## What ex3 does with them

| Pattern | In ex3 | Why |
| --- | --- | --- |
| Inline definitions | Every Overview figure has an info button with its definition, its exchange rate and what it leaves out; the chart's says how a missing close is treated | Plan priority 1; the references link to long articles, ex3 says it in place |
| Freshness and gaps stated | The quote time, the fallback and stale warnings, the missing symbols and rates, and a refresh that says when it did not recover | Where the references are silent, ex3 differentiates |
| Income apart from price | "Recorded income" sums what the ledger records, net of fees and taxes, per currency, labelled "not a forecast"; profit/loss says income is not in it | Snowball's received/estimated line, without the estimate |
| Capital, income and currency gain in one total | **Not adopted.** P/L stays unrealized and at today's rate, income stays apart, and there is no currency effect | A total return needs realized results, income and a currency split computed in one currency on one rule; adding today's pieces would mix bases ([`financial-rules.md`](financial-rules.md#what-these-definitions-do-not-do)) |
| Concentration | A line under the allocation names the largest position and what the three largest hold together | getquin's overexposure, from the shares the API already computes; ETF look-through needs holdings data ex3 does not have |
| Benchmark | The return view compares the portfolio's TWR with `BOVA11` or `VOO` over the same days | Already in place; rebasing to an index is the same comparison drawn differently |
| Target allocation and rebalancing | **Not adopted.** Evaluated in [`domain-model.md`](domain-model.md#open-decisions) | It needs user-defined targets, which the model does not store |
| Broker import, aggregation, community | **Out of scope** | Not part of ex3's product; the finances module is kept apart from the portfolio by design |
