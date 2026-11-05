import type { LocaleMessages, Messages } from '../catalog';

export default {
  description:
    'Bring your history from B3 or another broker into {name}. Nothing is recorded before you review the preview.',
  back: 'Back to assets',
  open: 'Import',
  file: {
    title: 'File',
    description:
      'Statements from the B3 Investor Area or the EX3 template, as XLSX or CSV, up to {size}.',
    choose: 'Choose file',
    change: 'Choose another file',
    drop: 'Drop the file here',
    reading: 'Reading {name}',
    chosen: '{name} · {size}',
    unsupported: 'Choose an XLSX spreadsheet or a CSV file.',
    tooLarge: 'The file is {size}, and the limit is {limit}.',
    empty: 'The file is empty.',
    readFailed: "The file couldn't be opened in this browser.",
    previewFailed: "Couldn't prepare the import preview",
    privacy:
      'The file is read on the server only to prepare the preview and is not kept. On import, EX3 keeps the transactions and, with each one, the row of the file it came from, so you can check its origin and undo the import. No broker or B3 password is ever asked for.'
  },
  sources: {
    title: 'Where the file comes from',
    b3: {
      title: 'B3 Investor Area',
      steps:
        'Sign in at investidor.b3.com.br and open Extratos. Movimentação has trades and income in one file; Negociação has trades alone, dated on the trading day. Filter the period and download the Excel file, then import it here as downloaded, without changing its columns.',
      costs:
        "B3 statements don't include brokerage, exchange fees or taxes on trades. Add them to each transaction afterwards, from the brokerage notes, or import them with the EX3 template.",
      coverage:
        'Buys, sells, dividends, interest on equity, fund income, bonus shares and splits are imported. Reverse splits, subscriptions, fraction auctions, mergers and options or forward trades are left out and recorded by hand.'
    },
    template: {
      title: 'EX3 template, for any broker',
      columns:
        'One transaction per row, with the columns Date, Type, Asset, Quantity and Price and, optionally, Fees, Taxes, Currency, Broker and Notes.',
      values:
        'Types: Buy, Sell, Dividend, JCP, Interest or Bonus. Dates as 2026-01-05, year first. In a comma-separated file, numbers as 1234.56; in one separated by semicolons, as 1234,56. For income, the price is the gross amount per unit, and the taxes what was withheld.',
      download: 'Download the CSV template'
    }
  },
  formats: {
    'b3-trades': 'B3 trading statement',
    'b3-income': 'B3 income received',
    'b3-movements': 'B3 movement statement',
    'ex3-template': 'EX3 template'
  },
  summary: {
    title: 'Preview',
    recognized: 'Recognized as {formats}',
    ready: 'Ready',
    toReview: 'To review',
    alreadyImported: 'Already imported',
    notImportable: 'Not importable',
    ignored: 'Ignored',
    selected: 'Selected',
    replanning: 'Updating the preview',
    replanFailed: "Couldn't update the preview",
    settlementDates:
      'The movement statement dates each trade on the day it settled, usually two business days after it was made. For trading days, import the trading statement first, or edit the dates after importing.'
  },
  assets: {
    title: 'Effect on positions',
    description:
      'How each position ends up with the selected rows, compared with today.',
    label: 'Effect of the import on each position',
    caption: 'Assets in the file and the effect of the selected rows',
    columns: {
      asset: 'Asset',
      rows: 'Rows',
      quantity: 'Quantity',
      averageCost: 'Average cost',
      investedValue: 'Invested',
      realizedProfitLoss: 'Realized P/L',
      income: 'Income'
    },
    rows: '{selected, number} of {total, number}',
    was: 'was <value></value>',
    resolutions: {
      held: 'In portfolio',
      tracked: 'New to portfolio',
      listed: 'New asset',
      unresolved: 'Not found'
    },
    refusals: {
      oversold:
        'Row {row} would sell more units than held on {date}. Include the earlier purchase or clear the sale.',
      oversoldUndated:
        'A selected sale exceeds the units held. Include the earlier purchase or clear the sale.',
      'currency-mismatch':
        "This position's transactions are in another currency. No row of this asset will be imported.",
      'out-of-range':
        'The resulting position exceeds the size EX3 records. No row of this asset will be imported.'
    },
    rowReference: '{sheet} · row {row, number}',
    rowReferenceWithoutSheet: 'row {row, number}'
  },
  rows: {
    title: 'Rows of the file',
    description:
      'Check what goes in. Ready rows come checked; possible duplicates and rows to review only if you check them.',
    label: 'Rows of the file',
    caption: 'Rows of the file, in the order they appear',
    pages: 'Pages of rows',
    filters: {
      label: 'Show',
      all: 'All',
      selected: 'Selected',
      attention: 'Need attention',
      skipped: 'Left out'
    },
    empty: 'No rows match this filter.',
    columns: {
      select: 'Import',
      row: 'Row',
      date: 'Date',
      type: 'Type',
      asset: 'Asset',
      quantity: 'Quantity',
      unitPrice: 'Price',
      costs: 'Costs',
      status: 'Status'
    },
    selectAll: 'Select every importable row in this filter',
    selectRow: 'Import row {row}',
    showOriginal: 'Show row {row} as it is in the file',
    hideOriginal: 'Hide row {row} as it is in the file',
    original: 'Original row',
    emptyCell: 'empty',
    statuses: {
      ready: 'Ready',
      review: 'Review',
      'possible-duplicate': 'Possible duplicate',
      duplicate: 'Already imported',
      unresolved: 'Asset not found',
      refused: 'Refused',
      ignored: 'Ignored',
      rejected: 'Invalid'
    },
    reasons: {
      settlement:
        'Purchase or sale the statement also lists as a settlement transfer, the row that is imported.',
      'custody-transfer': "Custody transfer: the position doesn't change.",
      lending: "Securities lending: the position doesn't change.",
      'listed-elsewhere':
        'The file already has this transaction in another row.',
      split:
        'Split: the credited units come in as a bonus with no cost. Check the quantity before including it.',
      'transferred-income':
        "Income B3 marks as transferred: check it isn't also in another row.",
      'not-listed': "The quote provider doesn't list this asset on B3.",
      'not-found': 'No EX3 asset has this symbol.',
      'market-data-unavailable':
        "The quote provider didn't answer. Try again in a moment.",
      'too-many-new-assets':
        'The file has too many new assets for one import. Import part of them first.',
      'currency-unknown': 'Fill in the currency in the Currency column.',
      'currency-mismatch': "The row's currency isn't the asset's.",
      oversold: 'Would sell more units than held.',
      'out-of-range': 'The resulting position exceeds the size recorded.'
    },
    matched:
      'A matching transaction already exists on this date, or on the day the trade was made or settled. Check it only if it is another trade.',
    warnings: {
      'value-mismatch':
        "The row's total differs from quantity × price; the price was used.",
      'withholding-derived':
        'The tax withheld was worked out from the net amount.',
      'unit-price-derived':
        'The amount per unit was worked out from the total.',
      'bonus-cost-unknown':
        "B3 doesn't report the cost attributed to the bonus; it comes in at no cost.",
      'split-as-bonus': 'Split recorded as a bonus with no cost.',
      'transferred-income': 'Transferred income.',
      'broker-truncated': 'The broker name was shortened.',
      'notes-truncated': 'The notes were shortened.'
    },
    problems: {
      'missing-value': '{field}: blank.',
      'invalid-date': '{field}: not a valid date.',
      'ambiguous-date':
        '{field}: write it as 2026-01-05, since 05/01/2026 could be read day or month first.',
      'future-date': '{field}: in the future.',
      'invalid-number': '{field}: not a valid number.',
      'not-positive': '{field}: must be greater than zero.',
      'invalid-symbol': '{field}: not a valid ticker.',
      'invalid-currency': '{field}: not an ISO 4217 currency.',
      'unsupported-type': "The row's type isn't accepted.",
      'unsupported-market':
        'Only the cash market is imported; options, forwards and futures are left out.',
      'unsupported-event':
        "This event isn't imported. Record it by hand if it changes the position.",
      'unsupported-product':
        "This product isn't imported, such as fixed income or Tesouro Direto.",
      'income-debit': "An income debit isn't imported."
    },
    fields: {
      date: 'Date',
      type: 'Type',
      market: 'Market',
      symbol: 'Asset',
      quantity: 'Quantity',
      unitPrice: 'Price',
      value: 'Amount',
      fees: 'Fees',
      taxes: 'Taxes',
      currency: 'Currency',
      unknown: 'Row'
    }
  },
  confirm: {
    submit:
      '{count, plural, =0 {No rows selected} one {Import # transaction} other {Import # transactions}}',
    pending: 'Updating the preview',
    importing: 'Importing',
    failed: "Couldn't import the transactions",
    note: 'The import is recorded at once: either every selected row goes in, or none does.'
  },
  result: {
    title: 'Import complete',
    description:
      '{count, plural, one {# transaction recorded} other {# transactions recorded}} from {file}.',
    positions:
      '{count, plural, =0 {No new positions.} one {# new position in the portfolio.} other {# new positions in the portfolio.}}',
    costsReminder:
      "B3 statements don't include costs: add brokerage and exchange fees to the transactions for an exact average cost.",
    viewAssets: 'View assets',
    importAnother: 'Import another file'
  },
  history: {
    title: 'Imports',
    description:
      'Each import can be undone: its transactions are deleted and the positions recalculated.',
    label: 'Imports of this portfolio',
    caption: 'Imports of this portfolio, newest first',
    pages: 'Pages of imports',
    loading: 'Loading the imports',
    loadFailed: "Couldn't load the imports",
    empty: 'No imports in this portfolio yet.',
    emptyPage: 'Page {page, number} has no imports.',
    goToPage: 'Go to page {page, number}',
    columns: {
      date: 'Date',
      file: 'File',
      transactions: 'Transactions',
      status: 'Status'
    },
    transactions: '{imported, number} of {rows, number} rows',
    active: 'Active',
    undone: 'Undone on {date}',
    undo: 'Undo<hidden> the import of {file}</hidden>',
    undoDialog: {
      title: 'Undo the import of {file}?',
      description:
        '{count, plural, =0 {No transaction of this import is still recorded} one {The transaction this import recorded will be deleted} other {The # transactions this import recorded will be deleted}}. The positions are recalculated, and a position it opened that ends up empty is closed. The record stays in this history.',
      confirm: 'Undo import',
      cancel: 'Keep',
      failed: "Couldn't undo the import"
    }
  },
  notifications: {
    imported:
      '{count, plural, one {# transaction imported} other {# transactions imported}}',
    undone: 'Import undone'
  }
} as const satisfies LocaleMessages<Messages['imports']>;
