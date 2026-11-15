import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class NotFoundError extends ApplicationError {
  constructor(message: string = Errors.NOT_FOUND.message) {
    super(message, Errors.NOT_FOUND.status, Errors.NOT_FOUND.code);
  }
}
