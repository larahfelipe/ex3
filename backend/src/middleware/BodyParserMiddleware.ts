import express, { type RequestHandler } from 'express';

import { RequestLimits, UploadRoutes } from '@/config/Constants';

const UPLOAD_PATHS = new Set<string>(
  Object.values(UploadRoutes).map((path) => path.toLowerCase())
);

const isUploadPath = (path: string) =>
  UPLOAD_PATHS.has(path.toLowerCase().replace(/\/+$/, ''));

const jsonBodyParser = express.json({ limit: RequestLimits.JSON_BODY_SIZE });

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
