import { Router, type Application } from 'express';

import {
  getAllPortfoliosControllerHandler,
  getPortfolioControllerHandler
} from '@/controllers/portfolio';
import { authMiddleware } from '@/middleware';

const portfolioRouter = Router();

portfolioRouter.get(
  '/v1/portfolio',
  authMiddleware as Application,
  getPortfolioControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolios',
  authMiddleware as Application,
  getAllPortfoliosControllerHandler as Application
);

export { portfolioRouter };
