import type { RateLimitInfo } from 'express-rate-limit';

import type { User } from '@/domain/models';
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user: User;
    requestId?: string;
    errorCode?: string;
    /** Set by `express-rate-limit` under its default `requestPropertyName`. */
    rateLimit?: RateLimitInfo;
  }
}
