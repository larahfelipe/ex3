import { Router } from 'express';

import {
  livenessControllerHandler,
  readinessControllerHandler
} from '@/controllers/health';

const healthRouter = Router();

healthRouter.get('/health', livenessControllerHandler);
healthRouter.get('/ready', readinessControllerHandler);

export { healthRouter };
