import { Errors } from '@/config';

import { ApplicationError } from './ApplicationError';

export class UnauthorizedError extends ApplicationError {
  constructor(message = Errors.UNAUTHORIZED.message) {
    super(message, Errors.UNAUTHORIZED.status, Errors.UNAUTHORIZED.name);
  }
}
