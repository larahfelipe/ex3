import { Router, type Application } from 'express';

import {
  createAssetControllerHandler,
  deleteAssetControllerHandler,
  getAllAssetsControllerHandler,
  getAssetControllerHandler,
  updateAssetControllerHandler
} from '@/controllers/asset';
import { authMiddleware } from '@/middleware';

const assetRouter = Router();

assetRouter.get(
  '/v1/asset/:symbol',
  authMiddleware as Application,
  getAssetControllerHandler as Application
);

assetRouter.get(
  '/v1/assets',
  authMiddleware as Application,
  getAllAssetsControllerHandler as Application
);

assetRouter.post(
  '/v1/asset',
  authMiddleware as Application,
  createAssetControllerHandler as Application
);

assetRouter.patch(
  '/v1/asset/:symbol',
  authMiddleware as Application,
  updateAssetControllerHandler as Application
);

assetRouter.delete(
  '/v1/asset/:symbol',
  authMiddleware as Application,
  deleteAssetControllerHandler as Application
);

export { assetRouter };
