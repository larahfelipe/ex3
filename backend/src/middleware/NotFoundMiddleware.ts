import type { RequestHandler } from 'express';

import { Errors } from '@/config/Constants';

export const notFoundMiddleware: RequestHandler = (_req, res) => {
  res.status(Errors.NOT_FOUND.status).json({
    code: Errors.NOT_FOUND.code,
    message: Errors.NOT_FOUND.message,
    details: []
  });
};
