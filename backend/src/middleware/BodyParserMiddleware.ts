import express, { type RequestHandler } from 'express';

import { RequestLimits, UploadRoutes } from '@/config/Constants';

const UPLOAD_PATHS = new Set<string>(
  Object.values(UploadRoutes).map((path) => path.toLowerCase())
);

/** Routing ignores case and a trailing slash, so the paths are compared the same way. */
const isUploadPath = (path: string) =>
  UPLOAD_PATHS.has(path.toLowerCase().replace(/\/+$/, ''));

const jsonBodyParser = express.json({ limit: RequestLimits.JSON_BODY_SIZE });

/**
 * Every body but an upload's is parsed before routing, to the small limit. An
 * upload's is left to `uploadBodyMiddleware`, behind authentication and its
 * rate limit, so no anonymous caller has a body of that size parsed.
 */
export const jsonBodyMiddleware: RequestHandler = (req, res, next) => {
  if (isUploadPath(req.path)) {
    next();
    return;
  }

  jsonBodyParser(req, res, next);
};

export const uploadBodyMiddleware = express.json({
  limit: RequestLimits.UPLOAD_BODY_SIZE
});
