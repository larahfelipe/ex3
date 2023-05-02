import { Router } from 'express';

import { portfolioRouter } from './PortfolioRoutes';
import { userRouter } from './UserRoutes';

const router = Router();

router.use(portfolioRouter);
router.use(userRouter);

export { router };
