import { Router } from 'express';

import { assetRouter } from './AssetRoutes';
import { portfolioRouter } from './PortfolioRoutes';
import { transactionRouter } from './TransactionRoutes';
import { userRouter } from './UserRoutes';

const router = Router();

router.use(assetRouter);
router.use(portfolioRouter);
router.use(transactionRouter);
router.use(userRouter);

export { router };
