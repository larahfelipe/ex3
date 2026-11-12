# Competitive benchmarking

What three investment trackers document about the patterns ex3 cares about, and
what ex3 took from each. Read on 2026-10-29 from the vendors' own pages; a claim
below is only what the page says, not something verified inside the product.
The finances module's expense categories are benchmarked apart, in
[Expense categories](#expense-categories).

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

## Expense categories

What budgeting apps and a Brazilian household-finance guide document about
expense categories, read on 2026-11-11 from their own pages. As above, a claim
is only what the page says.

| Source | Page |
| --- | --- |
| Serasa | <https://www.serasa.com.br/minhas-contas/blog/como-organizar-as-contas-de-casa-economizar/> |
| YNAB | <https://www.ynab.com/blog/how-many-ynab-categories>, <https://www.ynab.com/3-budget-category-setups-for-beginners> |
| Copilot Money | <https://help.copilot.money/en/articles/10684301-category-tips-tricks>, <https://help.copilot.money/en/articles/9829368-other-category> |
| Mobills | <https://ajuda.mobills.com.br/artigo/360052868553-o-que-sao-categorias> |
| Monarch Money | <https://help.monarch.com/hc/en-us/articles/360048883851> refused the request (HTTP 403); only a search snippet was seen |

### What the references document

* **Groups by purpose (Serasa).** Household bills by what they pay for:
  housing (rent, condominium, financing), fixed bills (water, electricity, gas,
  internet, phone), food, transport, education, health (health plan,
  medication, appointments), services and subscriptions (streaming, paid apps,
  gym) and other (clothes, gifts, small repairs) — each with examples. A second
  list in the same article sorts by rhythm instead: fixed, variable, seasonal
  (school supplies, taxes, year-end gifts) and extra.
* **Few categories, earned (YNAB).** "Start with fewer categories and then let
  any new ones earn their way into your budget", tested by "Will adding this
  category actually change my behavior?". New budgets get groups by rhythm —
  Bills, Frequent, Non-Monthly, Goals, Quality of Life Goals — and the beginner
  template puts insurance with the car ("Auto Insurance") and medical costs
  with the rest of the non-monthly ones.
* **Need and want (Copilot).** Default categories at onboarding, which the
  pages do not list, and a mandatory "Other". Its tips group categories into
  "Need" (rent, transportation, subscriptions) and "Want" (clothing,
  restaurants, shops).
* **Free categories, manual tagging (Mobills).** The help names a few
  (food, leisure, housing, studies, transport, travel) and says the app does
  not categorize on its own, so every category is chosen by hand.
* **Monarch** pairs a purpose with its subcategories in the snippet seen:
  "Food & Dining" (groceries, restaurants, coffee shops), "Auto & Transport".

### What ex3 does with them

| Pattern | In ex3 | Why |
| --- | --- | --- |
| Purpose, not instrument | Eleven categories by what a bill pays for. Insurance, taxes and debt were instruments that cut across purposes — car insurance was both *Transportation* and *Insurance*, the vehicle tax both *Transportation* and *Taxes* — so they went: what belongs to a purpose stays there, and the rest is *Financial* (loans, card statements, income tax, life insurance, bank fees). *Personal care* joined *Health & wellness* | Serasa and Monarch group by purpose; two homes for one bill make the category reports disagree with the user |
| Examples in place | Each category shows its examples under its name in the picker, which also finds it by them | Serasa lists examples per group; ex3 has no automatic categorization (as Mobills), so the choice must be quick and unambiguous by hand |
| A small fixed list | Eleven categories plus the free-text subcategory, and "Other" always present | YNAB's "fewer categories" and Copilot's mandatory "Other"; detail goes in the subcategory rather than in more categories |
| Groups by rhythm (YNAB, Serasa's second list) | **Not adopted** as categories | Rhythm is already a bill's kind — one-time, installment or recurring — which the reports split on separately |
| Need and want (Copilot) | **Not adopted** | It is a judgement per bill, not a property of a category, and would need a second field |
| User-defined categories | **Not adopted** | A fixed enum keeps the reports comparable across users and periods; the subcategory covers what the list does not |
