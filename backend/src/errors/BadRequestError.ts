import { Errors } from '@/config';

import { ApplicationError } from './ApplicationError';

export class BadRequestError extends ApplicationError {
  constructor(message = Errors.BAD_REQUEST.message) {
    super(message, Errors.BAD_REQUEST.status, Errors.BAD_REQUEST.name);
  }
}
