import { Router, type Application } from 'express';

import {
  createInstrumentControllerHandler,
  getAllInstrumentsControllerHandler,
  updateInstrumentControllerHandler
} from '@/controllers/instrument';
import { authMiddleware } from '@/middleware';

const instrumentRouter = Router();

instrumentRouter.get(
  '/v1/instruments',
  authMiddleware,
  getAllInstrumentsControllerHandler as Application
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
