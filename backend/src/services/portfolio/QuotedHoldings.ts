import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import type { Portfolio } from '@/domain/models';
import {
  foreignCurrenciesOf,
  holdsUnits,
  type PortfolioHoldings
} from '@/domain/PortfolioValuation';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { requireOwnedPortfolio, type PortfolioScope } from '../PortfolioAccess';

type PricedPosition = Awaited<
  ReturnType<AssetRepository['getPricedPositions']>
>[number];

export type PricedHoldings = {
  baseCurrency: Portfolio['baseCurrency'];
  positions: Array<PricedPosition>;
};

export type QuotedHoldings = PricedHoldings &
  Pick<PortfolioHoldings, 'quotes' | 'exchangeRates'>;

export const readPortfolioHoldings = async (
  assetRepository: AssetRepository,
  portfolioRepository: PortfolioRepository,
  { userId, portfolioId }: PortfolioScope
): Promise<PricedHoldings> => {
  const portfolio = await requireOwnedPortfolio(portfolioRepository, {
    userId,
    portfolioId
  });

  return {
    baseCurrency: portfolio.baseCurrency,
    positions: await assetRepository.getPricedPositions({
      portfolioId: portfolio.id
    })
  };
};

export const quoteHoldings = async (
  marketDataProvider: MarketDataProvider,
  holdings: PricedHoldings,
  valuedPositions: ReadonlyArray<PricedPosition> = holdings.positions.filter(
    holdsUnits
  )
): Promise<QuotedHoldings> => {
  const { baseCurrency } = holdings;

  const [quotes, exchangeRates] = await Promise.all([
    marketDataProvider.getQuotes(valuedPositions),
    marketDataProvider.getExchangeRates(
      foreignCurrenciesOf(valuedPositions, baseCurrency),
      baseCurrency
    )
  ]);

  return { ...holdings, quotes, exchangeRates };
};
