import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

/**
 * Every field is valid and the operation still cannot happen: a rule of the
 * domain refuses it, such as a sale beyond the units a position holds.
 */
export class DomainError extends ApplicationError {
  constructor(message: string = Errors.DOMAIN.message) {
    super(message, Errors.DOMAIN.status, Errors.DOMAIN.code);
  }
}
