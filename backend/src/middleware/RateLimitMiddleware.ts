import {
  rateLimit,
  type RateLimitExceededEventHandler
} from 'express-rate-limit';

import { Errors, RateLimits } from '@/config/Constants';

/**
 * The limiter answers on its own, without reaching the error boundary, so the
 * envelope and the code the request log reports are written here.
 */
const rejectThrottledRequest: RateLimitExceededEventHandler = (req, res) => {
  req.errorCode = Errors.THROTTLED.code;

  res.status(Errors.THROTTLED.status).json({
    code: Errors.THROTTLED.code,
    message: Errors.THROTTLED.message,
    details: []
  });
};

/**
 * Credential endpoints are the cheapest target for online guessing, so they get
 * a budget an order of magnitude tighter than the rest of the API.
 */
export const authRateLimitMiddleware = rateLimit({
  windowMs: RateLimits.AUTH.windowMs,
  limit: RateLimits.AUTH.limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rejectThrottledRequest
});

export const apiRateLimitMiddleware = rateLimit({
  windowMs: RateLimits.API.windowMs,
  limit: RateLimits.API.limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rejectThrottledRequest
});
