import { Router, type Application } from 'express';

import {
  createPortfolioControllerHandler,
  deletePortfolioControllerHandler,
  getAllPortfoliosControllerHandler,
  getPortfolioAllocationControllerHandler,
  getPortfolioControllerHandler,
  getPortfolioOverviewControllerHandler,
  getPortfolioPerformanceControllerHandler,
  getPortfolioPositionControllerHandler,
  getPortfolioPositionsControllerHandler,
  getPositionFundamentalsControllerHandler,
  getPositionIndicatorsControllerHandler,
  updatePortfolioControllerHandler
} from '@/controllers/portfolio';
import { authMiddleware } from '@/middleware';

const portfolioRouter = Router();

portfolioRouter.get(
  '/v1/portfolio',
  authMiddleware,
  getPortfolioControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/allocation',
  authMiddleware,
  getPortfolioAllocationControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/overview',
  authMiddleware,
  getPortfolioOverviewControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/performance',
  authMiddleware,
  getPortfolioPerformanceControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/positions',
  authMiddleware,
  getPortfolioPositionsControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/positions/:symbol',
  authMiddleware,
  getPortfolioPositionControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/positions/:symbol/indicators',
  authMiddleware,
  getPositionIndicatorsControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/positions/:symbol/fundamentals',
  authMiddleware,
  getPositionFundamentalsControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolios',
  authMiddleware,
  getAllPortfoliosControllerHandler as Application
);

portfolioRouter.post(
  '/v1/portfolio',
  authMiddleware,
  createPortfolioControllerHandler as Application
);

portfolioRouter.patch(
  '/v1/portfolio',
  authMiddleware,
  updatePortfolioControllerHandler as Application
);

portfolioRouter.delete(
  '/v1/portfolio',
  authMiddleware,
  deletePortfolioControllerHandler as Application
);

export { portfolioRouter };
