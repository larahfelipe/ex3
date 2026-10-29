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
    loading: 'Loading your portfolio',
    loadFailed: "Couldn't load your portfolio",
    noPortfolio: 'No portfolio found in this account',
    createPortfolio: 'Create a portfolio',
    value: {
      title: 'Portfolio value',
      loadFailed: "Couldn't load the portfolio value",
      loading: 'Loading the portfolio value',
      empty: 'There are no positions to value yet'
    },
    positions: {
      title: 'Positions',
      loadFailed: "Couldn't load the positions",
      loading: 'Loading the positions',
      empty: 'There are no positions yet',
      manage: 'Manage assets',
      table: 'Positions summary',
      caption: 'Positions valued in {currency}',
      pages: 'Position pages'
    },
    recentTransactions: {
      title: 'Recent transactions',
      loadFailed: "Couldn't load the recent transactions",
      loading: 'Loading the recent transactions',
      empty: 'There are no transactions yet'
    }
  },
  positions: {
    title: 'Positions',
    loading: 'Loading the positions',
    loadFailed: "Couldn't load the positions",
    empty: 'There are no positions yet',
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
      empty: 'There are no transactions for this asset yet',
      emptyPage: 'There are no transactions on page {page, number}',
      goToPage: 'Go to page {page, number}',
      pages: 'Transaction pages'
    }
  },
  allocation: {
    title: 'Allocation',
    loadFailed: "Couldn't load the allocation",
    loading: 'Loading the allocation',
    empty: 'There is no allocation to show',
    groupBy: 'Group allocation by',
    views: {
      type: 'Class',
      asset: 'Asset'
    },
    captions: {
      type: 'Allocation by class',
      asset: 'Allocation by asset'
    }
  },
  performance: {
    title: 'Performance',
    loadFailed: "Couldn't load the performance",
    loading: 'Loading the performance',
    emptyPeriod: 'There is no performance to show for this period',
    empty: 'There is no performance to show yet',
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
      return: 'Return'
    }
  }
} as const satisfies LocaleMessages<Messages['investments']>;
