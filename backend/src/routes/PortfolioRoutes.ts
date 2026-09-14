import { Router, type Application } from 'express';

import {
  createPortfolioControllerHandler,
  getAllPortfoliosControllerHandler,
  getPortfolioAllocationControllerHandler,
  getPortfolioControllerHandler,
  getPortfolioOverviewControllerHandler,
  getPortfolioPositionsControllerHandler
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
  '/v1/portfolio/positions',
  authMiddleware,
  getPortfolioPositionsControllerHandler as Application
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

export { portfolioRouter };
