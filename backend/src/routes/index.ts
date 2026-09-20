import { Router } from 'express';

import { assetRouter } from './AssetRoutes';
import { healthRouter } from './HealthRoutes';
import { instrumentRouter } from './InstrumentRoutes';
import { portfolioRouter } from './PortfolioRoutes';
import { transactionRouter } from './TransactionRoutes';
import { userRouter } from './UserRoutes';

const router = Router();

router.use(healthRouter);
router.use(assetRouter);
router.use(instrumentRouter);
router.use(portfolioRouter);
router.use(transactionRouter);
router.use(userRouter);

export { router };
