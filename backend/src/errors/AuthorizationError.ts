import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

/** The caller is known, and not allowed to do this. */
export class AuthorizationError extends ApplicationError {
  constructor(message: string = Errors.AUTHORIZATION.message) {
    super(message, Errors.AUTHORIZATION.status, Errors.AUTHORIZATION.code);
  }
}
