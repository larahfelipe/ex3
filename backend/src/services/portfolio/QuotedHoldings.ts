import type { MarketDataProvider } from '@/domain/MarketDataProvider';
import type { Portfolio } from '@/domain/models';
import {
  foreignCurrenciesOf,
  holdsUnits,
  type PortfolioHoldings
} from '@/domain/PortfolioValuation';
import type { AssetRepository, PortfolioRepository } from '@/infra/database';

import { type PortfolioScope, requireOwnedPortfolio } from '../PortfolioAccess';

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

/**
 * Only the valued positions are quoted, and every other one is still reported,
 * priced by the ledger alone.
 */
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
