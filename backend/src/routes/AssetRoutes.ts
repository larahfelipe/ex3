import { Router, type Application } from 'express';

import {
  createAssetControllerHandler,
  deleteAssetControllerHandler,
  getAllAssetsControllerHandler,
  getAssetControllerHandler,
  getAssetValuationsControllerHandler,
  updateAssetControllerHandler
} from '@/controllers/asset';
import { authMiddleware } from '@/middleware';

const assetRouter = Router();

assetRouter.get(
  '/v1/asset/:symbol',
  authMiddleware,
  getAssetControllerHandler as Application
);

assetRouter.get(
  '/v1/assets',
  authMiddleware,
  getAllAssetsControllerHandler as Application
);

assetRouter.get(
  '/v1/assets/valuations',
  authMiddleware,
  getAssetValuationsControllerHandler as Application
);

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
