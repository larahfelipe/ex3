import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';

import {
  apiRateLimitMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
  requestLogMiddleware
} from '@/middleware';
import { router } from '@/routes';

import { RequestLimits } from './Constants';
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
 * Cloud Run terminates TLS one hop in front of the app, so the client address
 * used for rate limiting comes from the first `X-Forwarded-For` entry. Outside
 * production nothing sits in front, and trusting the header would let a client
 * spoof its own identity.
 */
app.set('trust proxy', envs.isProduction ? 1 : false);

app.use(requestLogMiddleware);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: RequestLimits.JSON_BODY_SIZE }));
app.use(apiRateLimitMiddleware);
app.use(router);
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export { app };
