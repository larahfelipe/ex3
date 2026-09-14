import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { QuoteLookup } from './MarketDataProvider';
import {
  foreignCurrenciesOf,
  type ListedPosition,
  type PortfolioHoldings,
  summarizePortfolio,
  valuePositionsInBaseCurrency
} from './PortfolioValuation';

const BASE_CURRENCY = 'BRL';
const OBSERVED_AT = new Date('2026-09-11T19:55:00.000Z');

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
  previousClose?: string
): QuoteLookup => ({
  outcome: 'quoted',
  quote: {
    price,
    currency,
    timestamp: OBSERVED_AT,
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
  totalValue: '4711',
  investedValue: '4000',
  profitLoss: '711',
  profitLossPercent: '0.17775',
  dayChange: '711',
  dayChangePercent: '0.17775'
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
        totalValue: '5311',
        investedValue: '5000',
        profitLoss: '311',
        profitLossPercent: '0.0622',
        dayChange: '311',
        dayChangePercent: '0.0622'
      }
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
        totalValue: '162295',
        investedValue: '160000',
        profitLoss: '2295',
        profitLossPercent: '0.01434375',
        dayChange: '6045',
        dayChangePercent: '0.038688'
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
        totalValue: '2.250000000000000002',
        investedValue: '1.5',
        profitLoss: '0.750000000000000002',
        profitLossPercent: '0.500000000000000001',
        dayChange: '-0.000000000000000002',
        dayChangePercent: '0'
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
        totalValue: fromScaled(totalValue),
        investedValue: fromScaled(investedValue),
        profitLoss: fromScaled(profitLoss),
        profitLossPercent: fromScaled((profitLoss * unit) / investedValue)
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
      { baseCurrency: BASE_CURRENCY, investedValue: '5750' }
    );
  });

  it('leaves out the totals that need an exchange rate the provider did not give', () => {
    assert.deepEqual(
      summarize(
        [PETR4, holding('AAPL', '2', '400', 'USD')],
        { PETR4: PETR4_QUOTE, AAPL: quoted('229.5', 'USD', '225') },
        { USD: { outcome: 'not-found' } }
      ),
      { baseCurrency: BASE_CURRENCY }
    );
  });

  it('leaves out the invested value of a cost without a currency', () => {
    assert.deepEqual(
      summarize([holding('PETR4', '100', '4000', null)], {
        PETR4: PETR4_QUOTE
      }),
      {
        baseCurrency: BASE_CURRENCY,
        totalValue: '4711',
        dayChange: '711',
        dayChangePercent: '0.17775'
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
        totalValue: '5311',
        investedValue: '5000',
        profitLoss: '311',
        profitLossPercent: '0.0622'
      }
    );
  });

  it('adds nothing for a position without units, which needs no quote', () => {
    assert.deepEqual(
      summarize([PETR4, holding('OIBR3', '0', '0', null)], {
        PETR4: PETR4_QUOTE
      }),
      PETR4_OVERVIEW
    );
  });

  it('describes a portfolio without positions with zero totals and no percentages', () => {
    assert.deepEqual(summarize([], {}), {
      baseCurrency: BASE_CURRENCY,
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
