import { Router, type Application } from 'express';

import {
  createAssetControllerHandler,
  deleteAssetControllerHandler,
  updateAssetControllerHandler
} from '@/controllers/asset';
import { authMiddleware } from '@/middleware';

const assetRouter = Router();

assetRouter.post(
  '/v1/asset',
  authMiddleware,
  createAssetControllerHandler as Application
);

assetRouter.patch(
  '/v1/asset/:symbol',
  authMiddleware,
  updateAssetControllerHandler as Application
);

assetRouter.delete(
  '/v1/asset/:symbol',
  authMiddleware,
  deleteAssetControllerHandler as Application
);

export { assetRouter };
