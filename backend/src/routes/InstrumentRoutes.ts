import { Router, type Application } from 'express';

import {
  createInstrumentControllerHandler,
  getAllInstrumentsControllerHandler,
  searchInstrumentsControllerHandler,
  updateInstrumentControllerHandler
} from '@/controllers/instrument';
import {
  authMiddleware,
  instrumentSearchRateLimitMiddleware
} from '@/middleware';

const instrumentRouter = Router();

instrumentRouter.get(
  '/v1/instruments',
  authMiddleware,
  getAllInstrumentsControllerHandler as Application
);

instrumentRouter.get(
  '/v1/instruments/search',
  authMiddleware,
  instrumentSearchRateLimitMiddleware,
  searchInstrumentsControllerHandler as Application
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
