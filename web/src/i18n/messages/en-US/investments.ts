import type { LocaleMessages, Messages } from '../catalog';

export default {
  instrumentTypes: {
    STOCK: 'Stocks',
    ETF: 'ETFs',
    FUND: 'Funds',
    REIT: 'REITs',
    CRYPTO: 'Crypto',
    BOND: 'Fixed income',
    TREASURY: 'Government bonds',
    CASH: 'Cash',
    OTHER: 'Other'
  },
  metrics: {
    asset: 'Asset',
    quantity: 'Quantity',
    marketValue: 'Market value',
    allocation: 'Allocation',
    profitLoss: 'Profit/Loss',
    totalValue: 'Total value',
    dayChange: 'Day change',
    invested: 'Invested',
    value: 'Value',
    share: 'Share',
    pricesAsOf: 'Prices as of <quoted>{time}</quoted>'
  },
  overview: {
    description: '{name} · Base currency {currency}',
    addAsset: 'Add asset',
    portfolio: 'Portfolio',
    portfolioOption: '{name} · {currency}',
    allPortfolios: 'All portfolios',
    gettingStarted: {
      title: 'Get started',
      description:
        'This portfolio has no transactions yet. Adding an asset and recording what you bought fills this page with its value, performance and allocation.',
      complete:
        "Transaction recorded. The overview now shows the portfolio's value, performance and allocation.",
      done: 'done',
      dismiss: 'Hide guide',
      portfolio: {
        title: 'Check the portfolio',
        description:
          '{name} shows its figures in {currency}, its base currency, converting assets quoted in other currencies. You can rename it or change its currency on the Portfolios page.',
        action: 'Manage portfolios'
      },
      addAsset: {
        title: 'Add an asset',
        description:
          "Search for its ticker, such as PETR4 or VOO, and pick the listing you hold. Results show each listing's market and currency when the source provides them.",
        action: 'Add asset'
      },
      recordTransaction: {
        title: 'Record what you bought',
        description:
          'Enter the purchase with its date, quantity and price. Positions, costs and results are calculated from the transactions you record.',
        action: 'Record a transaction for {symbol}',
        recorded: 'Transaction recorded',
        otherAssets: 'Other assets'
      },
      follow: {
        title: 'Follow the portfolio here',
        description:
          "This page then shows the value at market prices, the return over time and how the money is allocated. Each figure's info button explains how it is calculated."
      }
    },
    loading: 'Loading your portfolio',
    loadFailed: "Couldn't load your portfolio",
    noPortfolioTitle: 'No portfolios yet',
    noPortfolio:
      'Create a portfolio to add assets and follow their value, performance and allocation.',
    createPortfolio: 'Create a portfolio',
    value: {
      title: 'Portfolio value',
      loadFailed: "Couldn't load the portfolio value",
      loading: 'Loading the portfolio value',
      empty:
        'No position is open right now, so there is nothing to value. The results of sold positions stay in the performance.',
      pricesTip: 'About these prices',
      pricesExplanation:
        "Prices come from a market-data source and may be delayed; they aren't real time. The time shown is that of the oldest price or exchange rate in the total.",
      definitions: {
        totalValue:
          'What the units you hold are worth at their latest prices, converted to {currency} at the latest exchange rates. It is shown only when every position has a price and a rate.',
        dayChange:
          "How the value of the units you hold now moved since each asset's previous close, at the same exchange rates. Buying or selling today doesn't count as a change.",
        invested:
          'What the units you hold cost: their average cost, including fees and taxes, converted to {currency} at the latest exchange rates. A sale lowers it by the cost of the units sold.',
        profitLoss:
          "Total value minus invested: the unrealized result of what you still hold. Results of sales and recorded income aren't part of it. Both use the latest exchange rates, so it doesn't separate price moves from currency moves."
      },
      marketData: {
        incomplete:
          "Only {valued, number} of {held, plural, one {# position} other {# positions}} could be valued in {currency}, so the totals can't be calculated.",
        costUnconverted:
          "Every position could be valued in {currency}, but the invested value and the profit/loss can't be calculated without the exchange rates below.",
        missingQuotes: {
          unavailable:
            "The price source didn't answer for <symbols></symbols>. This is usually temporary: refresh in a few minutes.",
          'not-found':
            'The price source has no price for <symbols></symbols>. Check {count, plural, one {the symbol} other {the symbols}} on the asset page.'
        },
        missingRates: {
          unavailable:
            "The source didn't answer for the {currencies} to {currency} exchange {count, plural, one {rate} other {rates}}. This is usually temporary: refresh in a few minutes.",
          'not-found':
            'The source has no {currencies} to {currency} exchange {count, plural, one {rate} other {rates}}.'
        },
        fallback:
          "The price source didn't answer, so some prices are the last ones received.",
        stale: 'The latest prices are more than four days old.'
      }
    },
    positions: {
      title: 'Positions',
      loadFailed: "Couldn't load the positions",
      loading: 'Loading the positions',
      empty:
        'No assets in this portfolio yet. Each one you add appears here with its value, its share of the portfolio and its result.',
      manage: 'Manage assets',
      table: 'Positions summary',
      caption: 'Positions valued in {currency}',
      shareOfPortfolio: '<share></share> of the portfolio',
      pages: 'Position pages'
    },
    recentTransactions: {
      title: 'Recent transactions',
      loadFailed: "Couldn't load the recent transactions",
      loading: 'Loading the recent transactions',
      empty:
        'No transactions recorded yet. Record the first one with "Add transaction" on the asset\'s page; purchases, sales and income appear here, the latest first.'
    },
    income: {
      title: 'Recorded income',
      loadFailed: "Couldn't load the recorded income",
      loading: 'Loading the recorded income',
      empty:
        'No income recorded yet. Record dividends, JCP and interest as transactions of the asset that paid them to follow them here.',
      trailingTotal: 'Last 12 months',
      trailingExplanation:
        "Income dated from {since} on: the same window as each asset's 12-month income.",
      total: 'All time',
      type: 'Type',
      table: 'Recorded income in {currency} by type',
      caption: 'Income in {currency} by type, net of fees and taxes',
      inCurrency: 'In {name} ({currency})',
      note: '{currencyCount, plural, one {Net of fees and taxes, as recorded in the transactions: what was paid, not a forecast.} other {Net of fees and taxes, as recorded in the transactions: what was paid, not a forecast. Each currency is shown apart, without conversion.}}'
    }
  },
  positions: {
    title: 'Positions',
    loading: 'Loading the positions',
    loadFailed: "Couldn't load the positions",
    emptyTitle: 'No assets in this portfolio',
    empty:
      'Add one to record its transactions and follow its value, cost and result here.',
    addAsset: 'Add asset',
    noResults: 'No position matches the search and filters',
    emptyPage: 'There are no positions on page {page, number}',
    goToPage: 'Go to page {page, number}',
    filter: 'Filter positions',
    search: 'Search positions',
    searchPlaceholder: 'Search by ticker or name',
    type: 'Class',
    allTypes: 'All classes',
    status: 'Status',
    allStatuses: 'All positions',
    statuses: {
      open: 'Open positions',
      closed: 'Closed positions'
    },
    clear: 'Clear',
    sort: 'Sort positions',
    sortBy: 'Sort by',
    descending: 'Descending order',
    sortFields: {
      symbol: 'Ticker',
      quantity: 'Quantity',
      averageCost: 'Average cost',
      marketPrice: 'Price',
      marketValue: 'Value',
      allocation: 'Allocation',
      profitLoss: 'Profit/Loss',
      profitLossPercent: 'Profit/Loss %'
    },
    columns: {
      symbol: 'Asset',
      quantity: 'Qty.',
      averageCost: 'Average cost',
      marketPrice: 'Price',
      marketValue: 'Value',
      allocation: 'Allocation',
      profitLoss: 'Profit/Loss'
    },
    actions: 'Options',
    table: 'Positions table',
    caption:
      'Positions valued in {currency}, sorted by {field} in {order, select, asc {ascending} other {descending}} order',
    averageCostOf: 'Average cost <price></price>',
    held: '<quantity></quantity> held',
    actionsFor: 'Options for {symbol}',
    viewDetails: 'View details',
    newTransaction: 'New transaction',
    delete: 'Delete',
    rowsPerPage: 'Rows per page',
    pages: 'Position pages',
    count:
      '{count, plural, =0 {no positions} one {# position} other {# positions}}'
  },
  assets: {
    add: {
      title: 'Add asset',
      description:
        'Search by ticker to add any listed instrument, or by name among the ones you already track.',
      search: 'Ticker or name',
      searchPlaceholder: 'PETR4, AAPL, BTC…',
      searchPattern:
        "The search accepts only letters, digits, spaces and . & ' -",
      searching: 'Searching…',
      found:
        '{count, plural, =0 {No instruments found} one {# instrument found} other {# instruments found}}',
      noListing:
        'Nothing is listed as “{search}”. Check the ticker, such as PETR4, AAPL or BTC.',
      noTracked:
        'No instrument you track matches “{search}”. To add a new one, search by ticker, such as PETR4.',
      marketUnavailable:
        "The market couldn't be searched right now, so instruments you don't track yet are missing. <retry>Try again</retry>",
      results: 'Instruments found',
      privateBadge: 'Private',
      newBadge: 'New',
      newListingNote:
        'New instruments are added with the name, class and sector the market reports, and only you see them.',
      choiceRequired: 'Choose one of the instruments found',
      alreadyHeld: '{symbol} is already in this portfolio',
      searchFailed: "Couldn't search the instruments",
      failed: "Couldn't add the asset",
      submit: 'Add'
    },
    deletion: {
      title: 'Delete {symbol}?',
      description:
        "Every {symbol} transaction in {portfolio} is deleted along with it, and this can't be undone.",
      confirm: 'Delete asset',
      failed: "Couldn't delete the asset"
    },
    notifications: {
      added: 'Asset added',
      addedTo: '{symbol} is now in {portfolio}',
      addTransaction: 'Add transaction',
      deleted: 'Asset deleted'
    }
  },
  asset: {
    addTransaction: 'Add transaction',
    back: 'Back to assets',
    loading: 'Loading this asset',
    loadFailed: "Couldn't load this asset",
    notHeld: "{symbol} isn't in your portfolio",
    viewAssets: 'View your assets',
    market: {
      title: 'Market',
      price: 'Price',
      dayChange: 'Day change',
      previousClose: 'Previous close',
      priceAsOf: 'Price as of <quoted>{time}</quoted>',
      type: 'Class',
      market: 'Market',
      currency: 'Currency',
      sector: 'Sector',
      historyLoadFailed: "Couldn't load the price history",
      historyLoading: 'Loading the price history',
      priceChange: 'Price change',
      yearRange: '52-week range',
      yearLow: 'Low',
      yearHigh: 'High',
      chartLabel: 'Daily closes',
      closeOn: '{price} on {day}',
      closesBetween:
        'Daily closes from {firstPrice} on {firstDay} to {lastPrice} on {lastDay}',
      changesSince:
        'Changes against the last close, <price></price>, on <closed>{day}</closed>'
    },
    position: {
      title: 'Position',
      marketValue: 'Market value',
      unrealizedProfitLoss: 'Unrealized profit/loss',
      quantity: 'Quantity',
      averageCost: 'Average cost',
      marketPrice: 'Market price',
      allocation: 'Allocation'
    },
    returns: {
      title: 'Returns',
      loadFailed: "Couldn't load the returns",
      loading: 'Loading the returns',
      empty: 'Returns start with the first transaction',
      realizedProfitLoss: 'Realized profit/loss',
      incomeReceived:
        '{kind, select, interest {Interest received} other {Income received}}',
      trailingIncome:
        '{kind, select, interest {Interest (12M)} other {Income (12M)}}',
      yieldOnCost: 'Yield on cost (12M)',
      yieldOnCostExplanation:
        'Income received over the last 12 months divided by the cost of the position.',
      since: 'First transaction'
    },
    fundamentals: {
      title: 'Fundamentals',
      loadFailed: "Couldn't load the fundamentals",
      loading: 'Loading the fundamentals',
      notApplicable: "Company fundamentals don't apply to this asset's class",
      notFound: 'The market data source has no fundamentals for this asset',
      unavailable:
        "The market data source couldn't be reached for the fundamentals",
      notReported: 'Not reported',
      source:
        "As reported by {source}; other sources may calculate them differently. Only the indicators that apply to this asset's class appear.",
      metrics: {
        priceToEarnings: {
          label: 'P/E',
          explanation:
            'Price divided by the trailing 12-month earnings per share: what the market pays for each unit of yearly profit. A lower multiple can mean a cheaper stock or lower expected growth, so compare within the same sector. Sources leave it out while earnings are negative.'
        },
        dividendYield: {
          label: 'Dividend yield (12M)',
          explanation:
            'Dividends or distributions paid over the last 12 months divided by the current price. Past payments do not guarantee future ones.'
        },
        returnOnEquity: {
          label: 'ROE',
          explanation:
            "Trailing 12-month net income divided by shareholders' equity: the profit earned on the shareholders' capital. Higher is better, unless heavy debt props it up."
        },
        profitMargin: {
          label: 'Profit margin',
          explanation:
            'Net income as a share of trailing 12-month revenue: how much of each sale is left as profit. Margins vary widely across sectors.'
        },
        debtToEquity: {
          label: 'Debt/Equity',
          explanation:
            "Total debt divided by shareholders' equity in the last reported quarter. Above 1× the company owes more than the shareholders put in; the prudent level depends on the sector."
        },
        revenueGrowth: {
          label: 'Revenue growth',
          explanation:
            'Revenue in the last reported quarter compared with the same quarter a year earlier.'
        },
        earningsGrowth: {
          label: 'Earnings growth',
          explanation:
            'Earnings in the last reported quarter compared with the same quarter a year earlier. It swings widely when the earlier quarter earned little.'
        },
        freeCashFlow: {
          label: 'Free cash flow (12M)',
          explanation:
            "Cash the business generated over the last 12 months after investments and interest, in the financial statements' currency. Positive means it funds itself."
        }
      }
    },
    transactions: {
      title: 'Transactions',
      loadFailed: "Couldn't load the transactions",
      loading: 'Loading the transactions',
      empty:
        'No transactions for this asset yet. Record a purchase with "Add transaction" to open the position; sales and income are recorded the same way.',
      emptyPage: 'There are no transactions on page {page, number}',
      goToPage: 'Go to page {page, number}',
      pages: 'Transaction pages'
    }
  },
  allocation: {
    title: 'Allocation',
    loadFailed: "Couldn't load the allocation",
    loading: 'Loading the allocation',
    empty:
      'No position is open, so there is nothing to allocate. The split by asset, class, sector and currency appears once the portfolio holds an asset.',
    groupBy: 'Group allocation by',
    views: {
      type: 'Class',
      asset: 'Asset',
      sector: 'Sector',
      currency: 'Currency'
    },
    captions: {
      type: 'Allocation by class',
      asset: 'Allocation by asset',
      sector: 'Allocation by sector',
      currency: 'Allocation by currency'
    },
    noSector: 'No sector',
    noCurrency: 'Unknown currency',
    concentration: {
      largest: 'The largest position, {symbol}, is {share} of the portfolio.',
      largestAndTop:
        'The largest position, {symbol}, is {share} of the portfolio; the {count, number} largest together are {topShare}.'
    },
    unpriced:
      'Shares appear once every position has a price; the portfolio value says which ones are missing.',
    unknownSector:
      'Sectors are reported for companies only, so ETFs, funds, crypto and similar assets have none.'
  },
  refresh: {
    done: 'Portfolio reloaded',
    doneDescription:
      'Prices are the latest the market-data source has published, so they may not have changed.',
    degraded:
      'Portfolio reloaded, but its market data is still incomplete or out of date',
    degradedDescription:
      'The portfolio value shows what is missing and what you can do.',
    failed:
      "Part of the portfolio couldn't be reloaded. The affected sections show what is out of date."
  },
  performance: {
    title: 'Performance',
    loadFailed: "Couldn't load the performance",
    loading: 'Loading the performance',
    emptyPeriod:
      'Nothing to show for this period: no position was held in it, or its prices are missing. Choose another period above.',
    empty:
      'No performance to show yet. The line starts on the first day a held asset has a market price and a rate, so it stays empty before then, or while the price source has none for it.',
    period: 'Period',
    ranges: {
      '1W': '1W',
      '1M': '1M',
      '3M': '3M',
      '6M': '6M',
      '1Y': '1Y',
      YTD: 'YTD',
      MAX: 'Max'
    },
    periods: {
      '1W': 'over the last week',
      '1M': 'over the last month',
      '3M': 'over the last three months',
      '6M': 'over the last six months',
      '1Y': 'over the last year',
      YTD: 'this year',
      MAX: 'since the first transaction'
    },
    metric: 'View',
    metrics: {
      value: 'Value',
      return: 'Return'
    },
    compareWith: 'Compare with',
    benchmarks: {
      none: 'No comparison',
      BOVA11: 'Ibovespa (BOVA11)',
      VOO: 'S&P 500 (VOO)'
    },
    portfolioSeries: 'Portfolio',
    valueChart: 'Value on each trading day',
    returnChart: 'Return on each trading day',
    pointValue: '{day}: {value}, with {invested} invested',
    pointReturn: '{day}: {return}',
    pointReturnAgainst: '{day}: {return}; {benchmark}: {benchmarkReturn}',
    investedOn: '{amount} invested',
    noBenchmarkReturn: 'no price',
    valueChangeTip: 'About this change',
    valueChangeExplanation:
      'The change in value includes the money that went into and out of the portfolio. To see only what the investments earned, use the return view.',
    netContributionNote: 'Includes {amount} in net contributions',
    benchmarkCaveat:
      "{benchmark}'s return counts only the change in its price, converted to {currency}, from the period's first day; dividends aren't included.",
    benchmarkWithoutCloses:
      "{benchmark} can't be compared in this period: the market-data source has no prices or exchange rates for it, or didn't respond. Refreshing later may help.",
    benchmarkNotFound: "{benchmark} isn't available to compare with right now.",
    gapsExplanation:
      'A day on which a held asset has no closing price or exchange rate, such as a holiday in one of its markets, is left out rather than valued in part.',
    returnTip: 'About this return',
    returnExplanation:
      "Time-weighted return: contributions and withdrawals don't count as gains or losses, so it can differ from the profit/loss.",
    portfolioCaption:
      "The portfolio's value and return on each trading day {period}",
    assetCaption: "{symbol}'s value and return on each trading day {period}",
    showTable: 'Performance as a table',
    table: 'Performance table',
    columns: {
      day: 'Day',
      value: 'Value',
      invested: 'Invested',
      netContribution: 'Net contribution',
      return: 'Return',
      benchmark: '{symbol} return'
    }
  }
} as const satisfies LocaleMessages<Messages['investments']>;
