import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

/** A dependency the request needs, such as the quote provider, cannot answer now. */
export class UnavailableError extends ApplicationError {
  constructor(message: string = Errors.UNAVAILABLE.message) {
    super(message, Errors.UNAVAILABLE.status, Errors.UNAVAILABLE.code);
  }
}
