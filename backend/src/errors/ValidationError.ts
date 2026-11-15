import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class ValidationError extends ApplicationError {
  constructor(
    message: string = Errors.VALIDATION.message,
    details: ApplicationError['details'] = []
  ) {
    super(message, Errors.VALIDATION.status, Errors.VALIDATION.code, details);
  }
}
