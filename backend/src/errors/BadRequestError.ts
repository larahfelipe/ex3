import { Errors } from '@/config';

import { ApplicationError } from './ApplicationError';

export class BadRequestError extends ApplicationError {
  constructor(
    message = Errors.BAD_REQUEST.message,
    details: ApplicationError['details'] = []
  ) {
    super(message, Errors.BAD_REQUEST.status, Errors.BAD_REQUEST.code, details);
  }
}
