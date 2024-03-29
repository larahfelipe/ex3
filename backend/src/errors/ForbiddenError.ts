import { Errors } from '@/config';

import { ApplicationError } from './ApplicationError';

export class ForbiddenError extends ApplicationError {
  constructor(message = Errors.FORBIDDEN.message) {
    super(message, Errors.FORBIDDEN.status, Errors.FORBIDDEN.name);
  }
}
