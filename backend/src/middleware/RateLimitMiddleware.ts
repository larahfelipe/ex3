import { rateLimit } from 'express-rate-limit';

import { Errors, RateLimits } from '@/config/Constants';

/**
 * Credential endpoints are the cheapest target for online guessing, so they get
 * a budget an order of magnitude tighter than the rest of the API.
 */
export const authRateLimitMiddleware = rateLimit({
  windowMs: RateLimits.AUTH.windowMs,
  limit: RateLimits.AUTH.limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    name: Errors.TOO_MANY_REQUESTS.name,
    message: Errors.TOO_MANY_REQUESTS.message
  }
});

export const apiRateLimitMiddleware = rateLimit({
  windowMs: RateLimits.API.windowMs,
  limit: RateLimits.API.limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    name: Errors.TOO_MANY_REQUESTS.name,
    message: Errors.TOO_MANY_REQUESTS.message
  }
});
