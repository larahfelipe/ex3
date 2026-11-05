import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';

import {
  apiRateLimitMiddleware,
  errorHandlerMiddleware,
  jsonBodyMiddleware,
  notFoundMiddleware,
  requestLogMiddleware
} from '@/middleware';
import { healthRouter, router } from '@/routes';

import { envs } from './Envs';

/**
 * An empty allowlist means no browser origin is trusted, which still lets
 * non-browser clients (no `Origin` header) through. `CORS_ALLOWED_ORIGINS` is
 * mandatory in production, so this only ever relaxes local development.
 */
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || envs.corsAllowedOrigins.includes(origin))
      return callback(null, true);

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
};

const app = express();

app.disable('x-powered-by');

/**
 * The runtime platform terminates TLS one hop in front of the app, so the
 * client address used for rate limiting comes from the first `X-Forwarded-For`
 * entry. Outside production nothing sits in front, and trusting the header
 * would let a client spoof its own identity.
 */
app.set('trust proxy', envs.isProduction ? 1 : false);

/**
 * Every answer is JSON for one caller, about one account, so no cache on the
 * way may keep it, and no page may embed or execute it.
 */
const helmetOptions: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }
  },
  frameguard: { action: 'deny' }
};

app.use(requestLogMiddleware);
app.use(helmet(helmetOptions));
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(cors(corsOptions));
app.use(jsonBodyMiddleware);
/**
 * The probes answer before the limiter, whose counters are in the database: a
 * database outage must fail readiness, not liveness, and an orchestrator that
 * polls them is not a client to throttle.
 */
app.use(healthRouter);
app.use(apiRateLimitMiddleware);
app.use(router);
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export { app };
