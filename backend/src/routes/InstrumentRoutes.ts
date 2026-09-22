import { Router, type Application } from 'express';

import {
  createInstrumentControllerHandler,
  getAllInstrumentsControllerHandler,
  getInstrumentOptionsControllerHandler,
  updateInstrumentControllerHandler
} from '@/controllers/instrument';
import { authMiddleware } from '@/middleware';

const instrumentRouter = Router();

instrumentRouter.get(
  '/v1/instruments',
  authMiddleware,
  getAllInstrumentsControllerHandler as Application
);

instrumentRouter.get(
  '/v1/instruments/options',
  authMiddleware,
  getInstrumentOptionsControllerHandler as Application
);

instrumentRouter.post(
  '/v1/instrument',
  authMiddleware,
  createInstrumentControllerHandler as Application
);

instrumentRouter.patch(
  '/v1/instrument/:symbol',
  authMiddleware,
  updateInstrumentControllerHandler as Application
);

export { instrumentRouter };
