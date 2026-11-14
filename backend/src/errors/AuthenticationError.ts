import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class AuthenticationError extends ApplicationError {
  constructor(message: string = Errors.AUTHENTICATION.message) {
    super(message, Errors.AUTHENTICATION.status, Errors.AUTHENTICATION.code);
  }
}
