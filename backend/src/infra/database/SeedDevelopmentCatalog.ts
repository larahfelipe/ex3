import { InstrumentTypes, Markets } from '@/config/Constants';
import { CreateInstrumentSchema } from '@/validation/schema';

import { PrismaClient } from './PrismaClient';

const DEVELOPMENT_CATALOG = [
  {
    symbol: 'PETR4',
    name: 'Petrobras PN',
    type: InstrumentTypes.STOCK,
    market: Markets.B3,
    currency: 'BRL',
    sector: 'Energy',
    country: 'BR'
  },
  {
    symbol: 'VALE3',
    name: 'Vale ON',
    type: InstrumentTypes.STOCK,
    market: Markets.B3,
    currency: 'BRL',
    sector: 'Materials',
    country: 'BR'
  },
  {
    symbol: 'ITUB4',
    name: 'Itaú Unibanco PN',
    type: InstrumentTypes.STOCK,
    market: Markets.B3,
    currency: 'BRL',
    sector: 'Financials',
    country: 'BR'
  },
  {
    symbol: 'BOVA11',
    name: 'iShares Ibovespa',
    type: InstrumentTypes.ETF,
    market: Markets.B3,
    currency: 'BRL',
    country: 'BR'
  },
  {
    symbol: 'HGLG11',
    name: 'CSHG Logística FII',
    type: InstrumentTypes.REIT,
    market: Markets.B3,
    currency: 'BRL',
    sector: 'Real Estate',
    country: 'BR'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: InstrumentTypes.STOCK,
    market: Markets.NASDAQ,
    currency: 'USD',
    sector: 'Technology',
    country: 'US'
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    type: InstrumentTypes.STOCK,
    market: Markets.NASDAQ,
    currency: 'USD',
    sector: 'Technology',
    country: 'US'
  },
  {
    symbol: 'KO',
    name: 'The Coca-Cola Company',
    type: InstrumentTypes.STOCK,
    market: Markets.NYSE,
    currency: 'USD',
    sector: 'Consumer Staples',
    country: 'US'
  },
  {
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    type: InstrumentTypes.ETF,
    market: Markets.NYSE,
    currency: 'USD',
    country: 'US'
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    type: InstrumentTypes.CRYPTO,
    market: Markets.CRYPTO,
    currency: 'USD'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    type: InstrumentTypes.CRYPTO,
    market: Markets.CRYPTO,
    currency: 'USD'
  }
];

const prismaClient = PrismaClient.getInstance();

const seedDevelopmentCatalog = async () => {
  const instruments = CreateInstrumentSchema.array().parse(DEVELOPMENT_CATALOG);

  await prismaClient.instrument.createMany({
    data: instruments,
    skipDuplicates: true
  });
};

void seedDevelopmentCatalog().finally(() => prismaClient.$disconnect());
