import type { User } from '@/domain/models';
import 'express';

declare module 'express' {
  export interface Request {
    user: User;
  }
}
