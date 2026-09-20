import type { User } from '@/domain/models';
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user: User;
    requestId?: string;
    errorCode?: string;
  }
}
