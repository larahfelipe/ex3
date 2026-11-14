import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class DomainError extends ApplicationError {
  constructor(message: string = Errors.DOMAIN.message) {
    super(message, Errors.DOMAIN.status, Errors.DOMAIN.code);
  }
}
