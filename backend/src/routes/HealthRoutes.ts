import { Router } from 'express';

import { ProbeRoutes } from '@/config/Constants';
import {
  livenessControllerHandler,
  readinessControllerHandler
} from '@/controllers/health';

const healthRouter = Router();

healthRouter.get(ProbeRoutes.LIVENESS, livenessControllerHandler);
healthRouter.get(ProbeRoutes.READINESS, readinessControllerHandler);

export { healthRouter };
