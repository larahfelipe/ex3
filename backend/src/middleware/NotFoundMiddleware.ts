import type { RequestHandler } from 'express';

import { Errors } from '@/config/Constants';

export const notFoundMiddleware: RequestHandler = (_req, res) => {
  res.status(Errors.NOT_FOUND.status).json({
    name: Errors.NOT_FOUND.name,
    message: Errors.NOT_FOUND.message
  });
};
