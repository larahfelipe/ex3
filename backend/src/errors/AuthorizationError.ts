import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class AuthorizationError extends ApplicationError {
  constructor(message: string = Errors.AUTHORIZATION.message) {
    super(message, Errors.AUTHORIZATION.status, Errors.AUTHORIZATION.code);
  }
}
