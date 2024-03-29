import { Errors } from '@/config';

import { ApplicationError } from './ApplicationError';

export class NotFoundError extends ApplicationError {
  constructor(message = Errors.NOT_FOUND.message) {
    super(message, Errors.NOT_FOUND.status, Errors.NOT_FOUND.name);
  }
}
