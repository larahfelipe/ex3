import { Errors } from '@/config/Constants';

import { ApplicationError } from './ApplicationError';

export class ConflictError extends ApplicationError {
  constructor(
    message: string = Errors.CONFLICT.message,
    details: ApplicationError['details'] = []
  ) {
    super(message, Errors.CONFLICT.status, Errors.CONFLICT.code, details);
  }
}
