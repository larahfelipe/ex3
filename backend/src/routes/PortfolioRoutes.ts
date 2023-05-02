import { Router, type Application } from 'express';

import {
  GetAllPortfoliosControllerHandler,
  GetPortfolioControllerHandler
} from '@/controllers/portfolio';
import { authMiddleware } from '@/middleware';

const portfolioRouter = Router();

portfolioRouter.get(
  '/v1/portfolio',
  authMiddleware as Application,
  GetPortfolioControllerHandler as Application
);

portfolioRouter.get(
  '/v1/portfolio/all',
  authMiddleware as Application,
  GetAllPortfoliosControllerHandler as Application
);

export { portfolioRouter };
