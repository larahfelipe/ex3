import { DefaultErrorMessages } from '@/constants';

import { ApplicationError } from './ApplicationError';

export class ForbiddenError extends ApplicationError {
  constructor(message = DefaultErrorMessages.FORBIDDEN) {
    super(message, 403, 'ForbiddenError');
  }
}
