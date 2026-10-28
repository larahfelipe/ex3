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

/**
 * A search can spend the quote provider's request quota, which every user
 * shares, so each signed-in user gets a budget of its own on top of the API's.
 */
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
