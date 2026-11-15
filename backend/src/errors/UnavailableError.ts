import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class UnavailableError extends ApplicationError {
  constructor(message: string = Errors.UNAVAILABLE.message) {
    super(message, Errors.UNAVAILABLE.status, Errors.UNAVAILABLE.code);
  }
}
