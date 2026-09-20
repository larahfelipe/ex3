import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

/** No usable identity: absent, malformed, expired or superseded credentials. */
export class AuthenticationError extends ApplicationError {
  constructor(message: string = Errors.AUTHENTICATION.message) {
    super(message, Errors.AUTHENTICATION.status, Errors.AUTHENTICATION.code);
  }
}
