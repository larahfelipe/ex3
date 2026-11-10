# Transaction import

People bring their trading history into a portfolio from a file: the
statements the B3 Investor Area exports, or EX3's own template for any other
broker. Nothing is recorded before the person reviews a preview, an import is
recorded whole or not at all, and an import can be undone.

| Layer | Where |
| --- | --- |
| Spreadsheet reading (XLSX, CSV) | `backend/src/infra/spreadsheet` |
| Formats, values, plan | `backend/src/domain/transaction-import` |
| Services | `backend/src/services/transaction-import` |
| Recording and undo | `backend/src/infra/database/TransactionImportRepository.ts` |
| Routes | `backend/src/routes/TransactionImportRoutes.ts` |
| Proxy and types | `web/src/app/api/v1/transaction-imports` |
| Screen | `web/src/app/(protected)/assets/import` |
| Templates | `web/public/templates` |

## Sources considered

Researched on 2026-11-04. "Verified" means read in an official B3 document;
anything else is marked.

| Option | Cost | Who may use it | Limitations | In EX3 |
| --- | --- | --- | --- | --- |
| **APIs da Área do Investidor** (developers.b3.com.br) | Per investor authorization. The technical manual states R$ 6.00 per authorization, charged at R$ 0.50 a month for 12 months; no charge for the first 6 months, 50% off from the 7th to the 24th; the first 10,000 authorizations per licensee exempt. Circular 177/2024-PRE announced a new tariff from 2025-01-02 "in the technical manual"; the manual downloaded is dated 2022-03-31 and has a `{XX}` placeholder, so whether these are the current figures is **not confirmed** | Legal entities only (CNPJ), under a license contract, after B3's self-assessment of data protection and information security (questionnaire, SecurityScorecard rating, a vulnerability report); B3 may refuse. The certification environment is free, with test data | OAuth, mutual TLS and JWT. Data up to D-1, from 08:00, history from 2019-11-01, SLA 97% a month, one query per investor per day recommended. The investor consents by linking their B3 account at investidor.b3.com.br and revokes under Minha Conta → Segurança → Aplicativos e Sites. The licensee must show the B3 brand by its manual, and never on a screen with investment recommendations | **Not implemented**: needs a company and a contract. See [Future work](#limitations-and-future-work) |
| **Investor Area exports** (investidor.b3.com.br → Extratos) | Free to the investor | The investor, signed in | Excel files per statement: Negociação, Movimentação, Proventos recebidos. B3 publishes no schema for them: the headers were taken from community parsers (Gerson-Santiago/b3, tbc174/tickerlab, luiznaac/portfolio-2, bangoim/bogle), not from B3, and may change without notice. Trades carry no fees. History assumed to start where the API's does, 2019-11-01 (**not confirmed** for the exports) | **Implemented** |
| **EX3 template** (CSV) | Free | Anyone | The person fills it from a broker's notes or another tool | **Implemented** |
| **Aggregators** (Pluggy, Belvo, Open Finance) | Paid, prices not public | Companies, under contract | Pluggy's public connector list (read 2026-11-04) has no B3 connector, only some brokers' (XP, BTG Pactual and others). Belvo advertises investment data; its coverage of B3 custody was not confirmed. Open Finance investment data was not verified | Not used: a paid third party for data the investor can download for free |
| **Brokerage notes** (PDF, SINACOR layout) | Free | The investor | The only source with each trade's fees. PDF layouts vary by broker | Not implemented: PDFs are refused (see [Future work](#limitations-and-future-work)) |
| **Scraping the Investor Area, or the former CEI**, with the person's CPF and password | — | — | Requires holding the person's B3 password; undocumented, unauthorized, against B3's terms. B3 replaced the CEI with the Investor Area and tells licensees not to use the CEI name | **Rejected** |

Sources: B3, *Manual Técnico APIs – Área Logada da B3*; B3, Ofício Circular
177/2024-PRE; b3.com.br, *Integrações da Área do
Investidor (APIs)*; developers.b3.com.br, *APIs – Área do Investidor*;
docs.pluggy.ai, *Connectors coverage*.

**Decision.** Manual import of the official free exports, plus a template for
any broker. It needs no contract, no third party and no credential, works
today for anyone with a B3 account, and keeps the person in control of what is
recorded. Automatic sync stays out until EX3 is run by a company that contracts
B3's API; the plan and recording below take rows from any source, so an API
adapter would be one more reader in front of them.

## Formats

The file's layout is recognized by its header row, searched in the first 20
rows of each sheet, so a title and a period above it are fine. A sheet no
format recognizes is skipped, and one workbook may hold several statements.
The B3 formats are tried before the template, whose aliases are the broadest,
so a header a B3 format recognizes is read by that format. A file that is not XLSX or CSV, is damaged, has no recognized
layout, no rows or too many answers `422 DOMAIN` with a message saying which.

| Format | Id | Columns read | Becomes | Not imported |
| --- | --- | --- | --- | --- |
| Negociação | `b3-trades` | Data do Negócio, Tipo de Movimentação, Mercado, Instituição, Código de Negociação, Quantidade, Preço, Valor | `BUY` and `SELL` in BRL, with no fees; a total that differs from quantity × price by a cent or more is a warning | Markets other than Mercado à Vista and Mercado Fracionário (options, forward, futures): rejected |
| Proventos Recebidos | `b3-income` | Produto, Pagamento, Tipo de Evento, Instituição, Quantidade, Preço unitário, Valor líquido | `DIVIDEND` (Dividendo, Rendimento), `JCP`, `INTEREST` (Juros). The unit value is gross and the amount net, so their difference is the tax withheld; with no unit value, or one too small to explain the net, the unit value is the net per unit and nothing is withheld | A product without a trading code (treasury bonds, CDBs), other events: rejected |
| Movimentação | `b3-movements` | Entrada/Saída, Data, Movimentação, Produto, Instituição, Quantidade, Preço unitário, Valor da Operação | Transferência - Liquidação as the trade it settles: `BUY` when credited (Credito, Entrada), `SELL` when debited (Debito, Saída), at its unit price, on the day it settled, in BRL, with no fees; a total that differs from quantity × price by a cent or more is a warning. Income credits as above; Bonificação em Ativos as `BONUS` at the cost B3 reports, zero with a warning when it reports none; Desdobro as a `BONUS` of the units it credits, at no cost, left for review; a credit marked "- Transferido" left for review | Compra, Venda and Compra / Venda, entries of a trade the statement also settles as a transfer (`settlement`); Transferência, custody moving between brokers (`custody-transfer`); lending (`lending`): ignored. A settlement with no unit price or another direction, a debited payment, reverse splits, subscriptions, fraction auctions and mergers: rejected, to be recorded by hand |
| EX3 template | `ex3-template` | Data, Tipo, Ativo, Quantidade, Preço, Taxas, Impostos, Moeda, Corretora, Observações, or Date, Type, Asset, Quantity, Price, Fees, Taxes, Currency, Broker, Notes, with common aliases | Any of `BUY`, `SELL`, `DIVIDEND`, `JCP`, `INTEREST`, `BONUS`. Income's price is gross and its taxes what was withheld; a bonus may leave the price empty; the currency, when left out, is the instrument's | — |

The templates are `web/public/templates/ex3-modelo-importacao.csv`
(semicolons, Portuguese headers) and `ex3-import-template.csv` (commas, English
headers), both UTF-8 with a byte order mark. The screen links the one for the
interface's language.

**Payments listed twice.** B3 lists a payment in the income statement and in
the movement statement, and the movement statement may list it again as
transferred. Within one file, the income statement's row is kept and the
others are ignored as `listed-elsewhere`, and a transferred credit gives way
to a plain one for the same symbol, type, day and quantity.

**Trades listed twice.** The movement statement dates a trade on the day it
settled, two business days after it was made on B3's current cycle (D+2), and
the trading statement on the day it was made. Within one file, the trading
statement's row is kept and a settlement of the same symbol, side, quantity and
price on that day or up to 7 calendar days later is ignored as
`listed-elsewhere`, each trade matching one settlement at most. The window
spans weekends and holidays without a calendar, and covers a move to D+1.

## Values

* **Dates.** A workbook date is the serial it stores, in the 1900 or 1904
  epoch the workbook declares. Text is read as `DD/MM/YYYY` in the B3 formats
  and under the template's Portuguese date headers. Under the English header
  (`Date`) a slashed date may put the month first, so the sheet's own dates
  decide: when the ones with a part past 12 all put the day first, or all the
  month, the sheet's slashed dates read that way; otherwise each is refused as
  `ambiguous-date`. A sheet that should put the day first but whose dates that
  show an order all put the month first, as a statement re-saved in another
  locale may, has its slashed dates refused the same way rather than switched. ISO `YYYY-MM-DD` and
  workbook dates read under every header. A time after the day is ignored, and
  a day after today, in UTC, is refused.
* **Execution time.** B3 reports days, not times, so a row is recorded at the
  first instant of its day in São Paulo, as the transaction form records a
  typed day. Within a day, acquisitions are recorded before sales, and income
  last, so a position opened and closed the same day is never sold before it
  is bought.
* **Numbers.** A numeric cell is the decimal the spreadsheet shows, to 15
  significant digits, so a stored `37.420000000000002` reads as `37.42`. Text
  accepts thousands groups and a currency sign (`R$ 1.234,56`). A value after a
  lone zero is a fraction (`R$ 0.018`, `0,018`). When a value alone does not fix
  the convention (`1.234`), the sheet's other text numbers do, if they all
  write the decimal the same way (`R$ 16,740.00`, `27.14`), as the movement
  statement seen writes its money with a decimal point. Otherwise the file's
  convention does: comma decimals, except in a CSV delimited by commas. Values
  must fit `DECIMAL(38,18)` without rounding; quantities and prices must be
  positive, fees and taxes non-negative.
* **Symbols.** A B3 code is a four-character root and a one or two-digit class
  (`PETR4`, `TAEE11`, `AAPL34`); the odd-lot `F` is dropped, since both codes
  trade one security. The income and movement statements give the code before
  the product's name (`PETR4 - PETROBRAS`).
* **Text.** Broker and notes are cut to the 60 and 500 characters a
  transaction stores, with a warning.

A row that does not become a transaction reports every problem it has at once,
each with its field: `missing-value`, `invalid-date`, `ambiguous-date`,
`future-date`, `invalid-number`, `not-positive`, `invalid-symbol`,
`invalid-currency`, `unsupported-type`, `unsupported-market`,
`unsupported-event`, `unsupported-product` and `income-debit`.

## Plan

The preview and the import plan the same way, in
`backend/src/domain/transaction-import/ImportPlan.ts`.

**Keys.** Each row that records a transaction has a key: a SHA-256 digest of
the format's namespace and what the row records (symbol, type, day, quantity,
price, fees, taxes, currency, broker; not notes), not of where it sits. Rows that
record the same thing, as two equal trades in one day, are told apart by their
count among the rows like them. The same statement exported again, over a
longer period or with its rows reordered, yields the same keys. Keys are
unique per portfolio in the database (`@@unique([portfolioId, importKey])`).

**Assets.** A symbol resolves, in order, to a position the portfolio holds, an
instrument the person sees (catalog or their own private one), or a listing the
quote provider knows. Of the listings in the row's currency, or all of them
when the row names none, B3's is picked, else the only one; several elsewhere
leave the symbol `currency-unknown`. Up to 50 new symbols per import are looked
up, in one search. A symbol in brapi's catalog of B3 tickers, read about once
a day, is answered from it with no request
([B3 ticker catalog](domain-model.md#b3-ticker-catalog)); the others go to the
quote provider, each only where it is quoted in its rows' currency, as a B3
statement's `{symbol}.SA` and `{symbol}-BRL` in BRL, 10 provider symbols per
request. The rest are unresolved. On import, the listing picked for each
selected symbol is described with its sector, four at a time, from the catalog
when it came from there.

| Status | Meaning | Selectable | Selected by default |
| --- | --- | --- | --- |
| `ready` | Becomes a transaction | yes | yes |
| `review` | B3 says too little to be sure: a split recorded as a bonus, a transferred credit | yes | no |
| `possible-duplicate` | The portfolio has a transaction on that day with the same type and quantity, which it names, or, for a B3 trade, a purchase or sale with the same type, quantity and price on the day it was made or settled (up to 7 calendar days apart). A same-day match is preferred, and each existing transaction matches one row at most | yes | no |
| `refused` | The asset's ledger with the selected rows does not replay: a sale exceeds what is held (`oversold`) or a position exceeds the columns (`out-of-range`). Every selected row of that asset is cleared, and the asset says the day and row it stopped at | yes, so the person can pick rows that replay | no |
| `duplicate` | Its key was already imported into the portfolio | no | — |
| `unresolved` | No instrument: `not-listed`, `not-found`, `market-data-unavailable`, `too-many-new-assets`, `currency-unknown`, `currency-mismatch` | no | — |
| `ignored` | Not a transaction of its own: `settlement`, `custody-transfer`, `lending`, `listed-elsewhere` | no | — |
| `rejected` | Its values are invalid (problems above) | no | — |

Each asset reports, before and after the selected rows, its quantity, average
cost, invested value and realized profit or loss, computed by the same ledger
replay that maintains positions (`backend/src/domain/PositionLedger.ts`), plus
the net income the rows add. The web shows these as the API sends them and
computes no financial figure.

## Recording

`POST /v1/transaction-import` sends the file again with the keys the preview
selected. Inside one serializable transaction, the repository reads the
portfolio again, plans again and, only when the rows to record are exactly
those selected, writes:

1. each new listing as the caller's private instrument, with the name, class
   and sector the provider describes, and its empty position;
2. the import: file name, SHA-256 of the file, formats, row and imported
   counts, and the instruments it opened positions for;
3. each transaction, with `importId`, its `importKey`, and `importedRow`, the
   format, sheet, row number and original cells, in the planned order (the
   sequences assigned are checked against it);
4. every position the plan rebuilt.

A different plan, because a row was imported or a transaction recorded
meanwhile, records nothing and answers `409 The portfolio changed since the
preview: review the import again`; the web plans again with the same
selection. A concurrent import that wins the unique key answers the same. A
new asset the provider cannot describe answers `503`, recording nothing. The
file is never stored: only its digest and name.

`importKey`, `importedRow` and `importId` stay out of the transaction API.
Editing an imported transaction keeps its key, so the same row is still a
duplicate in a later import.

## Undo

`DELETE /v1/transaction-import/:id` deletes the transactions the import
recorded that still exist, edited or not, and rebuilds each affected position
from what is left, in one serializable transaction. It is refused, touching
nothing, when the remaining ledger would not replay, as when a later sale
depends on a purchase the import brought. A position the import opened that is
left with no transaction is deleted; the private instruments it registered
stay. The import stays on record with `undoneAt`. Deleting a portfolio or an
account deletes its imports.

## Limits

| Limit | Value | Where |
| --- | --- | --- |
| File | 2 MiB | `ImportLimits.FILE_BYTES`, mirrored by the web's `TRANSACTION_IMPORT.FileMaxBytes` |
| Upload body (base64 plus selection) | 4 MiB (`4mb`), on the API and the proxy | `RequestLimits.UPLOAD_BODY_SIZE`, `REQUEST_LIMITS.UploadBodyBytes` |
| Other bodies | 100 KiB (`100kb`), unchanged | `RequestLimits.JSON_BODY_SIZE`, `REQUEST_LIMITS.JsonBodyBytes` |
| Data rows per import | 5000; more refuses the whole file | `ImportLimits.DATA_ROWS` |
| Sheets, rows per sheet, columns, cell length | 10, 6000, 40, 500 characters | `ImportLimits` |
| ZIP entries, bytes per entry, total inflated | 500, 16 MiB, 32 MiB | `ImportLimits` |
| New symbols looked up | 50, in one search; described four at a time on import | `ImportLimits.NEW_ASSETS`, `ImportLimits.LISTING_LOOKUP_CONCURRENCY` |
| Recording transaction | 30 s | `ImportLimits.RECORD_TIMEOUT_MS` |
| Rate | 30 preview or import requests per minute per user | `RateLimits.TRANSACTION_IMPORT` |
| Proxy timeout | 90 s | `TRANSACTION_IMPORT.RequestTimeoutMs` |

The sizes are judgments, not measurements of real statements.

## Performance

The file is read once per request and never kept, so a new plan after the
selection changes, and the import itself, send and read it again. The plan
runs on its rows in memory. Planning reads the portfolio in four queries
whatever the file's size (the positions and instruments of the file's
symbols, the keys already imported, the held assets' transactions), and
replays each asset's ledger once. The search for possible duplicates compares
a row only with the transactions of its asset, type and quantity, by days and
prices worked out once per transaction; within a file, a settlement is
compared only with the trades of its asset, side, quantity and price.
Recording inserts every transaction in one statement
(`createManyAndReturn`); only the new instruments (50 at most) and the
positions are written one per asset.

Measured on 2026-11-04 on the development VPS with generated data:

| Case | Time |
| --- | --- |
| Read 5000 movement rows over 50 assets as XLSX (149 KiB), median of five runs | 285 ms |
| Read the same rows as CSV (564 KiB), median of five runs | 192 ms |
| Plan them for an empty portfolio, median of five runs | 208 ms |
| Plan 5000 rows of one asset against 5000 of its transactions of the same type and quantity | 1.6 s |
| Plan 5000 rows of one asset against 5000 of its transactions of another quantity | 0.4 s |
| Read 2500 trades and 2500 settlements of one asset, none settling a trade | 0.47 s |
| Preview and record 5000 rows through the API against Postgres (integration test) | 3.8 s |

Heap in use stayed near 100 MiB. Before the comparisons were grouped, every
row was compared with every transaction of its asset: planning 2000 rows
against 2000 like transactions took 22.5 s, and reading the file of 2500
trades and settlements 10.3 s. The times now sit well inside the 30 s
recording and 90 s proxy limits, so the import stays one synchronous request,
with no job queue; the screen marks the request as pending and stays usable.
Two imports of the same file at once record it once: the second finds a
different plan, or loses the unique key, and answers `409`.

## Security

* **Authorization.** Every route requires a session. The portfolio is
  resolved through the caller (`requireOwnedPortfolio`), an import by its
  portfolio's owner; another user's portfolio or import answers as missing.
  The plan sees only the caller's private instruments.
* **Upload path.** The upload routes skip the global JSON parser and parse
  their larger body only after authentication and the import rate limit, so
  no anonymous caller has 4 MiB parsed (`BodyParserMiddleware.ts`). The proxy
  refuses a declared length past the limit unread and cancels a stream that
  runs past it. The schema requires padded base64, a file name without control
  characters, and SHA-256 keys.
* **Content, not claims.** The file's kind is decided by its bytes: a ZIP is
  read as an XLSX workbook, a legacy `.xls` and a PDF are refused by their
  signature, anything else is text. The name must then end in `.xlsx` for a
  workbook and `.csv` for text; it is checked, never used to decide how the
  file is read. The browser's media type is not sent: browsers report a CSV's
  inconsistently, so it would refuse good files and stop no bad one.
* **ZIP.** Only entries the central directory declares are read, each
  inflated against its declared size under per-entry and total budgets and
  checked against its CRC. Encrypted entries, ZIP64 and methods other than
  stored and deflate are refused.
* **XML.** A document type declaration is refused, so no entity can be
  defined or expanded (no XXE, no entity expansion); only the five predefined
  entities and character references are decoded. The scanner runs in time
  linear in the document's length. Only parts the workbook names are read.
* **Formulas and macros.** Formulas are never evaluated; a cell answers the
  value last saved with it. Nothing in the file is executed.
* **CSV.** UTF-8, UTF-16 with a byte order mark, or Windows-1252, read as
  RFC 4180. Cells are only ever read as values, never written back into a
  spreadsheet, so formula injection does not arise.
* **Storage and privacy.** The file is read in memory and discarded. EX3
  keeps the transactions and, with each, the row it came from, so the origin
  can be checked and the import undone; the screen says so. No broker or B3
  password is asked for or stored, and no token is held.
* **Quote provider.** Only symbols no known instrument has are sent, as
  registering an asset by hand sends them; those in the B3 ticker catalog are
  not sent at all. Reading the catalog sends brapi nothing about the file.

## Interface

`/assets/import`, opened from "Import" on the assets screen:

1. The person picks an `.xlsx` or `.csv` file, checked in the browser for
   extension, emptiness and size before it is sent. Beside it, how to export
   each B3 statement, the template to download, and what is kept.
2. The preview shows the file's formats, counts by group (ready, to review,
   already imported, not importable, ignored), each asset's figures before and
   after, and the rows, filtered by all, selected, needing attention or
   skipped, 50 per page. Each row shows its values, its notes (reason,
   warnings, problems) and, on demand, the original cells. A file with a
   movement statement adds a note that its trades are dated the day they
   settled.
3. Changing the selection plans again after a 700 ms pause, so the figures
   always match the rows that would be recorded; only the latest answer is
   shown.
4. Import records the selection and shows the result; the history below lists
   past imports with an undo, confirmed in a dialog.

Every message comes from the `imports` catalog in both languages; API refusals
are worded by `lib/api-error-message.ts`.

## Limitations and future work

* **No automatic sync.** It needs B3's API contract, available to companies
  only. With one, an adapter that reads Negociação de Ativos, Movimentação and
  Eventos Provisionados would produce rows for the same plan and recording.
  It should reuse the export formats' key namespace where the fields agree, or
  rows already imported from an export would be flagged only as possible
  duplicates.
* **No fees on B3 trades.** B3's statements omit brokerage, exchange and
  settlement fees, so average cost and realized P/L are slightly off until the
  person adds them or imports trades through the template. Reading brokerage
  notes (PDF) would fix this; PDFs are refused today.
* **Corporate actions.** Reverse splits, subscriptions, fraction auctions and
  mergers are rejected for the person to record by hand; a split comes in as a
  bonus of the credited units, which keeps the cost and the quantity right but
  is left for review.
* **Renamed tickers** are not followed: rows under an old code resolve to that
  code's instrument, if one is known or still listed, or stay unresolved.
* **Order within a day** is assumed (acquisitions, sales, income), since B3
  gives no time.
* **Settlement dates.** Trades from the movement statement are dated the day
  they settled, usually two business days late, which moves them across a
  month or a performance period and shifts the day a sale realizes its result.
  Importing the trading statement first keeps the trading day: the
  settlements then show as possible duplicates. B3 may settle several trades
  of a day in one transfer, at their average price, which then matches none of
  them and needs a look; a day trade that nets to no units may settle none, so
  its result would not come in from this statement.
* **Compra and Venda entries** of the movement statement are assumed to repeat
  a trade it also lists as a settlement transfer. A statement that lists a
  trade only as Compra or Venda would leave it out; those rows show as ignored
  with that reason, for the person to check.
* **B3's export layouts** come from community parsers and may change. No real
  B3 file was available; the tests use workbooks built from those headers
  (`backend/src/test/WorkbookBuilder.ts`) and, for the movement statement, from
  the columns and values of a screenshot of the report.
* **History.** The API's starts in November 2019, and the statements' is
  assumed to as well; earlier trades need the template.
* **English template** reads a slashed date only when the sheet's dates show
  their order; ISO dates always.
* **Templates** are served behind sign-in, like every page but the public ones.

## Verified and unvalidated

**Implemented and verified by tests that ran on 2026-11-04**: 435 backend unit
tests, 441 backend integration tests against Postgres and 225 web unit tests,
all passing, with type checks, ESLint and Prettier in both packages, and
production builds of the API and the web. What they cover is in
[`testing.md`](testing.md#transaction-import).

**Not validated.**

* No real B3 export was parsed; the movement statement's mapping follows a
  screenshot of the report, not its file.
* No browser: the screen's layout, focus and responsiveness were not seen.
* No running server: the proxy's limits and the routes were tested in
  isolation and through the API's HTTP tests, not end to end.
* The duration was measured on the development VPS only, with a generated
  file; the limits are not measured against real statements.
* The aggregators' coverage and prices, and whether the API's tariff is
  current, were not confirmed with the providers.
