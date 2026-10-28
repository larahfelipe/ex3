import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SortOrderTypes } from '@/config/Constants';

import type { QuoteLookup } from './MarketDataProvider';
import {
  type AllocatedPosition,
  allocatePortfolio,
  describePosition,
  foreignCurrenciesOf,
  type ListedPosition,
  matchesPositionFilter,
  type PortfolioHoldings,
  type PortfolioPosition,
  type PositionDetail,
  type PositionFilter,
  PositionStatuses,
  sortPositionsBy,
  summarizePortfolio,
  valuePositionsInBaseCurrency
} from './PortfolioValuation';

const BASE_CURRENCY = 'BRL';
const OBSERVED_AT = new Date('2026-09-11T19:55:00.000Z');
const EARLIER = new Date('2026-09-11T19:50:00.000Z');
const EARLIEST = new Date('2026-09-11T19:45:00.000Z');

/** Mirror `DecimalColumn`. */
const COLUMN_SCALE = 18;
const COLUMN_MAXIMUM = '99999999999999999999.999999999999999999';

type Holding = PortfolioHoldings['positions'][number];

const holding = (
  symbol: string,
  quantity: string,
  investedValue: string,
  ledgerCurrency: string | null = BASE_CURRENCY
): Holding => ({ symbol, quantity, investedValue, ledgerCurrency });

const quoted = (
  price: string,
  currency: string,
  previousClose?: string,
  timestamp = OBSERVED_AT
): QuoteLookup => ({
  outcome: 'quoted',
  quote: {
    price,
    currency,
    timestamp,
    source: 'test',
    ...(previousClose !== undefined && { previousClose })
  }
});

const summarize = (
  positions: Holding[],
  quotes: Record<string, QuoteLookup>,
  exchangeRates: Record<string, QuoteLookup> = {}
) =>
  summarizePortfolio({
    baseCurrency: BASE_CURRENCY,
    positions,
    quotes: new Map(Object.entries(quotes)),
    exchangeRates: new Map(Object.entries(exchangeRates))
  });

const toScaled = (decimal: string) => {
  const [integer, fraction = ''] = decimal.split('.');

  return BigInt(integer + fraction.padEnd(COLUMN_SCALE, '0'));
};

const fromScaled = (scaled: bigint) => {
  const digits = scaled.toString().padStart(COLUMN_SCALE + 1, '0');
  const fraction = digits.slice(-COLUMN_SCALE).replace(/0+$/, '');
  const integer = digits.slice(0, -COLUMN_SCALE);

  return fraction ? `${integer}.${fraction}` : integer;
};

const PETR4 = holding('PETR4', '100', '4000');
const PETR4_QUOTE = quoted('47.11', 'BRL', '40');

const PETR4_OVERVIEW = {
  baseCurrency: BASE_CURRENCY,
  heldPositionCount: 1,
  totalValue: '4711',
  investedValue: '4000',
  profitLoss: '711',
  profitLossPercent: '0.17775',
  dayChange: '711',
  dayChangePercent: '0.17775',
  quotedAt: OBSERVED_AT
};

describe('summarizePortfolio', () => {
  it('adds up the positions, with the profit over the cost and the change since the previous close', () => {
    assert.deepEqual(
      summarize([PETR4, holding('VALE3', '10', '1000')], {
        PETR4: PETR4_QUOTE,
        VALE3: quoted('60', 'BRL', '100')
      }),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 2,
        totalValue: '5311',
        investedValue: '5000',
        profitLoss: '311',
        profitLossPercent: '0.0622',
        dayChange: '311',
        dayChangePercent: '0.0622',
        quotedAt: OBSERVED_AT
      }
    );
  });

  it('dates the totals by the oldest quote, or exchange rate of a quote, the total value used', () => {
    const positions = [PETR4, holding('AAPL', '2', '400', 'EUR')];
    const ledgerRate = quoted('6', 'BRL', undefined, EARLIEST);
    const AAPL_QUOTE = quoted('229.5', 'USD', '225');

    assert.deepEqual(
      summarize(
        positions,
        { PETR4: quoted('47.11', 'BRL', '40', EARLIER), AAPL: AAPL_QUOTE },
        { USD: quoted('5', 'BRL'), EUR: ledgerRate }
      ).quotedAt,
      EARLIER
    );
    assert.deepEqual(
      summarize(
        positions,
        { PETR4: PETR4_QUOTE, AAPL: AAPL_QUOTE },
        { USD: quoted('5', 'BRL', undefined, EARLIER), EUR: ledgerRate }
      ).quotedAt,
      EARLIER
    );
  });

  it('converts each amount at the rate from its own currency', () => {
    assert.deepEqual(
      summarize(
        [
          holding('AAPL', '2', '400', 'USD'),
          holding('BTC', '0.5', '158000', 'BRL')
        ],
        {
          AAPL: quoted('229.5', 'USD', '225'),
          BTC: quoted('64000', 'USD', '61600')
        },
        { USD: quoted('5', 'BRL') }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 2,
        totalValue: '162295',
        investedValue: '160000',
        profitLoss: '2295',
        profitLossPercent: '0.01434375',
        dayChange: '6045',
        dayChangePercent: '0.038688',
        quotedAt: OBSERVED_AT
      }
    );
  });

  it('truncates every total and percentage towards zero at the column scale', () => {
    assert.deepEqual(
      summarize(
        [holding('AAPL', '1.5', '1', 'USD')],
        {
          AAPL: quoted('1.000000000000000001', 'USD', '1.000000000000000002')
        },
        { USD: quoted('1.5', 'BRL') }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 1,
        totalValue: '2.250000000000000002',
        investedValue: '1.5',
        profitLoss: '0.750000000000000002',
        profitLossPercent: '0.500000000000000001',
        dayChange: '-0.000000000000000002',
        dayChangePercent: '0',
        quotedAt: OBSERVED_AT
      }
    );
  });

  it('keeps every digit of totals of positions at the bounds of the columns', () => {
    const maximum = toScaled(COLUMN_MAXIMUM);
    const unit = 10n ** BigInt(COLUMN_SCALE);
    const totalValue = (2n * maximum ** 3n) / unit ** 2n;
    const investedValue = (2n * maximum ** 2n) / unit;
    const profitLoss = totalValue - investedValue;

    assert.deepEqual(
      summarize(
        [
          holding('AAPL', COLUMN_MAXIMUM, COLUMN_MAXIMUM, 'USD'),
          holding('KO', COLUMN_MAXIMUM, COLUMN_MAXIMUM, 'USD')
        ],
        {
          AAPL: quoted(COLUMN_MAXIMUM, 'USD'),
          KO: quoted(COLUMN_MAXIMUM, 'USD')
        },
        { USD: quoted(COLUMN_MAXIMUM, 'BRL') }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 2,
        totalValue: fromScaled(totalValue),
        investedValue: fromScaled(investedValue),
        profitLoss: fromScaled(profitLoss),
        profitLossPercent: fromScaled((profitLoss * unit) / investedValue),
        quotedAt: OBSERVED_AT
      }
    );
  });

  it('leaves out the totals that need a quote the provider did not give', () => {
    assert.deepEqual(
      summarize(
        [PETR4, holding('KO', '1', '350', 'USD')],
        { PETR4: PETR4_QUOTE, KO: { outcome: 'unavailable' } },
        { USD: quoted('5', 'BRL') }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 2,
        investedValue: '5750'
      }
    );
  });

  it('leaves out the totals that need an exchange rate the provider did not give', () => {
    assert.deepEqual(
      summarize(
        [PETR4, holding('AAPL', '2', '400', 'USD')],
        { PETR4: PETR4_QUOTE, AAPL: quoted('229.5', 'USD', '225') },
        { USD: { outcome: 'not-found' } }
      ),
      { baseCurrency: BASE_CURRENCY, heldPositionCount: 2 }
    );
  });

  it('leaves out the invested value of a cost without a currency', () => {
    assert.deepEqual(
      summarize([holding('PETR4', '100', '4000', null)], {
        PETR4: PETR4_QUOTE
      }),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 1,
        totalValue: '4711',
        dayChange: '711',
        dayChangePercent: '0.17775',
        quotedAt: OBSERVED_AT
      }
    );
  });

  it('leaves out the change of the day unless every position has a previous close', () => {
    assert.deepEqual(
      summarize([PETR4, holding('VALE3', '10', '1000')], {
        PETR4: PETR4_QUOTE,
        VALE3: quoted('60', 'BRL')
      }),
      {
        baseCurrency: BASE_CURRENCY,
        heldPositionCount: 2,
        totalValue: '5311',
        investedValue: '5000',
        profitLoss: '311',
        profitLossPercent: '0.0622',
        quotedAt: OBSERVED_AT
      }
    );
  });

  it('adds nothing for a position without units, which needs no quote and is not held', () => {
    assert.deepEqual(
      summarize([PETR4, holding('OIBR3', '0', '0', null)], {
        PETR4: PETR4_QUOTE
      }),
      PETR4_OVERVIEW
    );
  });

  it('describes a portfolio without positions as holding none, with zero totals and no percentages', () => {
    assert.deepEqual(summarize([], {}), {
      baseCurrency: BASE_CURRENCY,
      heldPositionCount: 0,
      totalValue: '0',
      investedValue: '0',
      profitLoss: '0',
      dayChange: '0'
    });
  });
});

const listed = (
  { symbol, quantity, investedValue, ledgerCurrency }: Holding,
  averageCost: string
): ListedPosition => ({
  symbol,
  name: `Name of ${symbol}`,
  quantity,
  averageCost,
  investedValue,
  ledgerCurrency
});

const valueListed = (
  positions: ListedPosition[],
  quotes: Record<string, QuoteLookup>,
  exchangeRates: Record<string, QuoteLookup> = {},
  listedPositions = positions
) =>
  valuePositionsInBaseCurrency(
    {
      baseCurrency: BASE_CURRENCY,
      positions,
      quotes: new Map(Object.entries(quotes)),
      exchangeRates: new Map(Object.entries(exchangeRates))
    },
    listedPositions
  );

const positionOf = ({ symbol, name, quantity }: ListedPosition) => ({
  symbol,
  name,
  quantity,
  baseCurrency: BASE_CURRENCY
});

const PETR4_LISTED = listed(holding('PETR4', '100', '3200'), '32');
const AAPL_LISTED = listed(holding('AAPL', '2', '250', 'USD'), '125');
const LISTED_QUOTES = {
  PETR4: quoted('40', 'BRL'),
  AAPL: quoted('100', 'USD')
};
const USD_RATE = quoted('5', 'BRL');

const PETR4_POSITION = {
  ...positionOf(PETR4_LISTED),
  averageCost: '32',
  marketPrice: '40',
  marketValue: '4000',
  allocation: '0.8',
  profitLoss: '800',
  profitLossPercent: '0.25'
};
const AAPL_POSITION = {
  ...positionOf(AAPL_LISTED),
  averageCost: '625',
  marketPrice: '500',
  marketValue: '1000',
  allocation: '0.2',
  profitLoss: '-250',
  profitLossPercent: '-0.2'
};

describe('valuePositionsInBaseCurrency', () => {
  it('values each position in the base currency with its share of the portfolio', () => {
    assert.deepEqual(
      valueListed([PETR4_LISTED, AAPL_LISTED], LISTED_QUOTES, {
        USD: USD_RATE
      }),
      [PETR4_POSITION, AAPL_POSITION]
    );
  });

  it('gives the share of the whole portfolio, not of the positions listed', () => {
    assert.deepEqual(
      valueListed(
        [PETR4_LISTED, AAPL_LISTED],
        LISTED_QUOTES,
        { USD: USD_RATE },
        [AAPL_LISTED]
      ),
      [AAPL_POSITION]
    );
  });

  it('truncates prices, values and shares towards zero at the column scale', () => {
    const ko = listed(holding('KO', '1', '1', 'USD'), '1');
    const petr4 = listed(holding('PETR4', '3', '3'), '1');

    assert.deepEqual(
      valueListed(
        [ko, petr4],
        {
          KO: quoted('1.000000000000000001', 'USD'),
          PETR4: quoted('1', 'BRL')
        },
        { USD: quoted('1.5', 'BRL') }
      ),
      [
        {
          ...positionOf(ko),
          averageCost: '1.5',
          marketPrice: '1.500000000000000001',
          marketValue: '1.500000000000000001',
          allocation: '0.333333333333333333',
          profitLoss: '0.000000000000000001',
          profitLossPercent: '0'
        },
        {
          ...positionOf(petr4),
          averageCost: '1',
          marketPrice: '1',
          marketValue: '3',
          allocation: '0.666666666666666666',
          profitLoss: '0',
          profitLossPercent: '0'
        }
      ]
    );
  });

  it('keeps every digit of positions at the bounds of the columns', () => {
    const maximum = toScaled(COLUMN_MAXIMUM);
    const unit = 10n ** BigInt(COLUMN_SCALE);
    const maximumConverted = maximum ** 2n / unit;
    const marketValue = maximum ** 3n / unit ** 2n;
    const totalValue = (2n * maximum ** 3n) / unit ** 2n;
    const profitLoss = marketValue - maximumConverted;
    const aapl = listed(
      holding('AAPL', COLUMN_MAXIMUM, COLUMN_MAXIMUM, 'USD'),
      COLUMN_MAXIMUM
    );
    const ko = listed(
      holding('KO', COLUMN_MAXIMUM, COLUMN_MAXIMUM, 'USD'),
      COLUMN_MAXIMUM
    );

    assert.deepEqual(
      valueListed(
        [aapl, ko],
        {
          AAPL: quoted(COLUMN_MAXIMUM, 'USD'),
          KO: quoted(COLUMN_MAXIMUM, 'USD')
        },
        { USD: quoted(COLUMN_MAXIMUM, 'BRL') },
        [aapl]
      ),
      [
        {
          ...positionOf(aapl),
          averageCost: fromScaled(maximumConverted),
          marketPrice: fromScaled(maximumConverted),
          marketValue: fromScaled(marketValue),
          allocation: fromScaled((marketValue * unit) / totalValue),
          profitLoss: fromScaled(profitLoss),
          profitLossPercent: fromScaled((profitLoss * unit) / maximumConverted)
        }
      ]
    );
  });

  it('leaves out the values that need a quote or an exchange rate the provider did not give', () => {
    const ko = listed(holding('KO', '1', '350', 'USD'), '350');
    const vow3 = listed(holding('VOW3', '10', '900'), '90');

    assert.deepEqual(
      valueListed(
        [PETR4_LISTED, ko, vow3],
        {
          PETR4: quoted('40', 'BRL'),
          KO: { outcome: 'unavailable' },
          VOW3: quoted('95', 'EUR')
        },
        { USD: USD_RATE, EUR: { outcome: 'not-found' } }
      ),
      [
        {
          ...positionOf(PETR4_LISTED),
          averageCost: '32',
          marketPrice: '40',
          marketValue: '4000',
          profitLoss: '800',
          profitLossPercent: '0.25'
        },
        { ...positionOf(ko), averageCost: '1750' },
        { ...positionOf(vow3), averageCost: '90' }
      ]
    );
  });

  it('leaves out the cost of a position without a currency', () => {
    const petr4 = listed(holding('PETR4', '100', '3200', null), '32');

    assert.deepEqual(valueListed([petr4], { PETR4: quoted('40', 'BRL') }), [
      {
        ...positionOf(petr4),
        marketPrice: '40',
        marketValue: '4000',
        allocation: '1'
      }
    ]);
  });

  it('values a position without units at zero, outside the shares of the others', () => {
    const oibr3 = listed(holding('OIBR3', '0', '0'), '2');

    assert.deepEqual(
      valueListed([PETR4_LISTED, oibr3], {
        PETR4: quoted('40', 'BRL'),
        OIBR3: quoted('1.5', 'BRL')
      }),
      [
        { ...PETR4_POSITION, allocation: '1' },
        {
          ...positionOf(oibr3),
          averageCost: '2',
          marketPrice: '1.5',
          marketValue: '0',
          allocation: '0',
          profitLoss: '0'
        }
      ]
    );
  });

  it('gives no share in a portfolio worth zero at the column scale', () => {
    const dust = listed(holding('DUST', '0.000000000000000001', '0'), '0');

    assert.deepEqual(
      valueListed([dust], { DUST: quoted('0.000000000000000001', 'BRL') }),
      [
        {
          ...positionOf(dust),
          averageCost: '0',
          marketPrice: '0.000000000000000001',
          marketValue: '0',
          profitLoss: '0'
        }
      ]
    );
  });
});

const filterable = (
  symbol: string,
  name: string,
  type: AllocatedPosition['type'],
  quantity: string
) => ({ symbol, name, type, quantity });

const FILTERABLE_POSITIONS = [
  filterable('PETR4', 'Petrobras', 'STOCK', '100'),
  filterable('BOVA11', 'iShares Ibovespa', 'ETF', '0.000000000000000001'),
  filterable('OIBR3', 'Oi', 'STOCK', '0')
];

const symbolsMatching = (filter: PositionFilter) =>
  FILTERABLE_POSITIONS.filter(matchesPositionFilter(filter)).map(
    ({ symbol }) => symbol
  );

describe('describePosition', () => {
  const AAPL_CATALOG: Pick<
    PositionDetail,
    'type' | 'market' | 'currency' | 'sector'
  > = {
    type: 'STOCK',
    market: 'NASDAQ',
    currency: 'USD',
    sector: 'Technology'
  };

  const describeAapl = (aaplQuote: QuoteLookup) =>
    describePosition(
      {
        baseCurrency: BASE_CURRENCY,
        positions: [PETR4_LISTED, AAPL_LISTED],
        quotes: new Map([
          ['PETR4', LISTED_QUOTES.PETR4],
          ['AAPL', aaplQuote]
        ]),
        exchangeRates: new Map([['USD', USD_RATE]])
      },
      { ...AAPL_LISTED, ...AAPL_CATALOG }
    );

  it('values the position in the base currency next to its quote in the currency it was quoted in, with the change since the previous close', () => {
    assert.deepEqual(describeAapl(quoted('100', 'USD', '80')), {
      ...AAPL_POSITION,
      ...AAPL_CATALOG,
      quote: {
        price: '100',
        currency: 'USD',
        timestamp: OBSERVED_AT,
        previousClose: '80',
        dayChange: '20',
        dayChangePercent: '0.25'
      }
    });
  });

  it('truncates the change of the day and its percentage towards zero at the column scale', () => {
    assert.deepEqual(
      describeAapl(quoted('2.0000000000000000019', 'USD', '3')).quote,
      {
        price: '2.0000000000000000019',
        currency: 'USD',
        timestamp: OBSERVED_AT,
        previousClose: '3',
        dayChange: '-0.999999999999999998',
        dayChangePercent: '-0.333333333333333332'
      }
    );
  });

  it('leaves out the change of the day without a previous close, and its percentage for a close of zero', () => {
    assert.deepEqual(describeAapl(quoted('100', 'USD')).quote, {
      price: '100',
      currency: 'USD',
      timestamp: OBSERVED_AT
    });
    assert.deepEqual(describeAapl(quoted('100', 'USD', '0')).quote, {
      price: '100',
      currency: 'USD',
      timestamp: OBSERVED_AT,
      previousClose: '0',
      dayChange: '100'
    });
  });

  it('leaves out the quote and the values that need it when the provider did not give one', () => {
    assert.deepEqual(describeAapl({ outcome: 'unavailable' }), {
      ...positionOf(AAPL_LISTED),
      ...AAPL_CATALOG,
      averageCost: '625'
    });
  });
});

describe('matchesPositionFilter', () => {
  it('matches every position without a criterion', () => {
    assert.deepEqual(symbolsMatching({}), ['PETR4', 'BOVA11', 'OIBR3']);
  });

  it('matches a search in part of the symbol or of the name, in any letter case', () => {
    assert.deepEqual(symbolsMatching({ search: 'petr' }), ['PETR4']);
    assert.deepEqual(symbolsMatching({ search: 'IBOV' }), ['BOVA11']);
    assert.deepEqual(symbolsMatching({ search: 'vale' }), []);
  });

  it('matches the type, and whether the position holds any units', () => {
    assert.deepEqual(symbolsMatching({ type: 'STOCK' }), ['PETR4', 'OIBR3']);
    assert.deepEqual(symbolsMatching({ status: PositionStatuses.OPEN }), [
      'PETR4',
      'BOVA11'
    ]);
    assert.deepEqual(symbolsMatching({ status: PositionStatuses.CLOSED }), [
      'OIBR3'
    ]);
  });

  it('matches only the positions that meet every criterion', () => {
    assert.deepEqual(
      symbolsMatching({
        search: 'o',
        type: 'STOCK',
        status: PositionStatuses.OPEN
      }),
      ['PETR4']
    );
  });
});

const withProfitLoss = (
  symbol: string,
  profitLoss?: string
): PortfolioPosition => ({
  symbol,
  name: `Name of ${symbol}`,
  quantity: '1',
  baseCurrency: BASE_CURRENCY,
  ...(profitLoss !== undefined && { profitLoss })
});

const symbolsByProfitLoss = (
  positions: ReadonlyArray<PortfolioPosition>,
  sortOrder: (typeof SortOrderTypes)[keyof typeof SortOrderTypes]
) =>
  sortPositionsBy(positions, 'profitLoss', sortOrder).map(
    ({ symbol }) => symbol
  );

describe('sortPositionsBy', () => {
  it('compares the values as decimals in either direction, the positions without one last', () => {
    const positions = [
      withProfitLoss('AAPL', '10'),
      withProfitLoss('BBAS3'),
      withProfitLoss('PETR4', '9.5'),
      withProfitLoss('VALE3', '-250')
    ];

    assert.deepEqual(symbolsByProfitLoss(positions, SortOrderTypes.ASCENDENT), [
      'VALE3',
      'PETR4',
      'AAPL',
      'BBAS3'
    ]);
    assert.deepEqual(
      symbolsByProfitLoss(positions, SortOrderTypes.DESCENDENT),
      ['AAPL', 'PETR4', 'VALE3', 'BBAS3']
    );
  });

  it('keeps ties in the order the positions came in, in either direction', () => {
    const positions = [
      withProfitLoss('AAPL', '1'),
      withProfitLoss('BBAS3'),
      withProfitLoss('PETR4', '1.0'),
      withProfitLoss('VALE3')
    ];

    for (const sortOrder of Object.values(SortOrderTypes))
      assert.deepEqual(symbolsByProfitLoss(positions, sortOrder), [
        'AAPL',
        'PETR4',
        'BBAS3',
        'VALE3'
      ]);
  });
});

describe('foreignCurrenciesOf', () => {
  it('names once each currency of the positions other than the base', () => {
    assert.deepEqual(
      foreignCurrenciesOf(
        [
          { currency: 'USD', ledgerCurrency: 'BRL' },
          { currency: 'USD', ledgerCurrency: 'USD' },
          { currency: null, ledgerCurrency: null },
          { currency: 'BRL', ledgerCurrency: 'EUR' }
        ],
        BASE_CURRENCY
      ),
      ['USD', 'EUR']
    );
  });
});

type Catalog = Pick<AllocatedPosition, 'type' | 'sector' | 'currency'>;

const allocated = (
  symbol: string,
  quantity: string,
  catalog: Catalog
): AllocatedPosition => ({
  ...listed(holding(symbol, quantity, '0'), '0'),
  ...catalog
});

const allocate = (
  positions: AllocatedPosition[],
  quotes: Record<string, QuoteLookup>,
  exchangeRates: Record<string, QuoteLookup> = {}
) =>
  allocatePortfolio({
    baseCurrency: BASE_CURRENCY,
    positions,
    quotes: new Map(Object.entries(quotes)),
    exchangeRates: new Map(Object.entries(exchangeRates))
  });

const PETR4_CATALOG: Catalog = {
  type: 'STOCK',
  sector: 'Energy',
  currency: 'BRL'
};

describe('allocatePortfolio', () => {
  it('breaks the positions with units down by asset, type, sector and currency, in the base currency', () => {
    assert.deepEqual(
      allocate(
        [
          allocated('AAPL', '2', {
            type: 'STOCK',
            sector: 'Technology',
            currency: 'USD'
          }),
          allocated('BTC', '0.004', {
            type: 'CRYPTO',
            sector: null,
            currency: 'USD'
          }),
          allocated('OIBR3', '0', {
            type: 'STOCK',
            sector: 'Telecom',
            currency: 'BRL'
          }),
          allocated('PETR4', '100', PETR4_CATALOG)
        ],
        {
          AAPL: quoted('100', 'USD'),
          BTC: quoted('50000', 'USD'),
          OIBR3: quoted('1.5', 'BRL'),
          PETR4: quoted('30', 'BRL')
        },
        { USD: USD_RATE }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        totalValue: '5000',
        byAsset: [
          {
            symbol: 'AAPL',
            name: 'Name of AAPL',
            marketValue: '1000',
            allocation: '0.2'
          },
          {
            symbol: 'BTC',
            name: 'Name of BTC',
            marketValue: '1000',
            allocation: '0.2'
          },
          {
            symbol: 'PETR4',
            name: 'Name of PETR4',
            marketValue: '3000',
            allocation: '0.6'
          }
        ],
        byType: [
          { type: 'CRYPTO', marketValue: '1000', allocation: '0.2' },
          { type: 'STOCK', marketValue: '4000', allocation: '0.8' }
        ],
        bySector: [
          { sector: 'Energy', marketValue: '3000', allocation: '0.6' },
          { sector: 'Technology', marketValue: '1000', allocation: '0.2' },
          { sector: null, marketValue: '1000', allocation: '0.2' }
        ],
        byCurrency: [
          { currency: 'BRL', marketValue: '3000', allocation: '0.6' },
          { currency: 'USD', marketValue: '2000', allocation: '0.4' }
        ]
      }
    );
  });

  it('adds up in every breakdown the truncated values and shares of the positions, short of the whole by less than one unit of the column scale each', () => {
    const consumerStockInUsd: Catalog = {
      type: 'STOCK',
      sector: 'Consumer',
      currency: 'USD'
    };
    const allocation = allocate(
      [
        allocated('KO', '1', consumerStockInUsd),
        allocated('PEP', '1', consumerStockInUsd),
        allocated('PETR4', '1', PETR4_CATALOG),
        allocated('XPML11', '1', {
          type: 'REIT',
          sector: null,
          currency: 'BRL'
        })
      ],
      {
        KO: quoted('1.000000000000000001', 'USD'),
        PEP: quoted('1.000000000000000001', 'USD'),
        PETR4: quoted('1', 'BRL'),
        XPML11: quoted('1', 'BRL')
      },
      { USD: quoted('1.5', 'BRL') }
    );

    assert.deepEqual(allocation, {
      baseCurrency: BASE_CURRENCY,
      totalValue: '5.000000000000000003',
      byAsset: [
        {
          symbol: 'KO',
          name: 'Name of KO',
          marketValue: '1.500000000000000001',
          allocation: '0.3'
        },
        {
          symbol: 'PEP',
          name: 'Name of PEP',
          marketValue: '1.500000000000000001',
          allocation: '0.3'
        },
        {
          symbol: 'PETR4',
          name: 'Name of PETR4',
          marketValue: '1',
          allocation: '0.199999999999999999'
        },
        {
          symbol: 'XPML11',
          name: 'Name of XPML11',
          marketValue: '1',
          allocation: '0.199999999999999999'
        }
      ],
      byType: [
        { type: 'REIT', marketValue: '1', allocation: '0.199999999999999999' },
        {
          type: 'STOCK',
          marketValue: '4.000000000000000002',
          allocation: '0.799999999999999999'
        }
      ],
      bySector: [
        {
          sector: 'Consumer',
          marketValue: '3.000000000000000002',
          allocation: '0.6'
        },
        {
          sector: 'Energy',
          marketValue: '1',
          allocation: '0.199999999999999999'
        },
        { sector: null, marketValue: '1', allocation: '0.199999999999999999' }
      ],
      byCurrency: [
        {
          currency: 'BRL',
          marketValue: '2',
          allocation: '0.399999999999999998'
        },
        {
          currency: 'USD',
          marketValue: '3.000000000000000002',
          allocation: '0.6'
        }
      ]
    });

    const unit = 10n ** BigInt(COLUMN_SCALE);
    const whole = toScaled(allocation.totalValue!);
    const positionCount = BigInt(allocation.byAsset.length);
    const breakdowns: ReadonlyArray<
      ReadonlyArray<Partial<Record<'marketValue' | 'allocation', string>>>
    > = [
      allocation.byAsset,
      allocation.byType,
      allocation.bySector,
      allocation.byCurrency
    ];

    for (const breakdown of breakdowns) {
      const value = breakdown.reduce(
        (sum, { marketValue }) => sum + toScaled(marketValue!),
        0n
      );
      const share = breakdown.reduce(
        (sum, { allocation: part }) => sum + toScaled(part!),
        0n
      );

      assert.ok(value <= whole && whole - value < positionCount);
      assert.ok(
        share <= unit && (unit - share) * whole < positionCount * (whole + unit)
      );
    }
  });

  it('counts a position in the currency of its quote, or of the catalog without one', () => {
    const { byCurrency } = allocate(
      [
        allocated('BABA', '2', {
          type: 'STOCK',
          sector: 'Consumer',
          currency: 'HKD'
        }),
        allocated('NESN', '1', {
          type: 'STOCK',
          sector: 'Consumer',
          currency: 'CHF'
        }),
        allocated('PETR4', '100', PETR4_CATALOG)
      ],
      {
        BABA: quoted('100', 'USD'),
        NESN: { outcome: 'unavailable' },
        PETR4: quoted('40', 'BRL')
      },
      { USD: USD_RATE }
    );

    assert.deepEqual(byCurrency, [
      { currency: 'BRL', marketValue: '4000' },
      { currency: 'CHF' },
      { currency: 'USD', marketValue: '1000' }
    ]);
  });

  it('leaves out the total, every share and the value of each group with a position the provider did not quote or convert', () => {
    assert.deepEqual(
      allocate(
        [
          allocated('PETR4', '100', PETR4_CATALOG),
          allocated('VALE3', '10', {
            type: 'STOCK',
            sector: 'Materials',
            currency: 'BRL'
          }),
          allocated('VOW3', '10', {
            type: 'STOCK',
            sector: 'Industrials',
            currency: 'EUR'
          })
        ],
        {
          PETR4: quoted('40', 'BRL'),
          VALE3: { outcome: 'unavailable' },
          VOW3: quoted('95', 'EUR')
        },
        { EUR: { outcome: 'not-found' } }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        byAsset: [
          { symbol: 'PETR4', name: 'Name of PETR4', marketValue: '4000' },
          { symbol: 'VALE3', name: 'Name of VALE3' },
          { symbol: 'VOW3', name: 'Name of VOW3' }
        ],
        byType: [{ type: 'STOCK' }],
        bySector: [
          { sector: 'Energy', marketValue: '4000' },
          { sector: 'Industrials' },
          { sector: 'Materials' }
        ],
        byCurrency: [{ currency: 'BRL' }, { currency: 'EUR' }]
      }
    );
  });

  it('describes a portfolio without positions with units as worth zero, with nothing to break down', () => {
    assert.deepEqual(
      allocate(
        [allocated('OIBR3', '0', { ...PETR4_CATALOG, sector: 'Telecom' })],
        {}
      ),
      {
        baseCurrency: BASE_CURRENCY,
        totalValue: '0',
        byAsset: [],
        byType: [],
        bySector: [],
        byCurrency: []
      }
    );
  });

  it('gives no share in a portfolio worth zero at the column scale', () => {
    assert.deepEqual(
      allocate(
        [
          allocated('DUST', '0.000000000000000001', {
            type: 'CRYPTO',
            sector: null,
            currency: 'BRL'
          })
        ],
        { DUST: quoted('0.000000000000000001', 'BRL') }
      ),
      {
        baseCurrency: BASE_CURRENCY,
        totalValue: '0',
        byAsset: [{ symbol: 'DUST', name: 'Name of DUST', marketValue: '0' }],
        byType: [{ type: 'CRYPTO', marketValue: '0' }],
        bySector: [{ sector: null, marketValue: '0' }],
        byCurrency: [{ currency: 'BRL', marketValue: '0' }]
      }
    );
  });
});
