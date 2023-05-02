import { DefaultErrorMessages } from '@/constants';

import { ApplicationError } from './ApplicationError';

export class UnauthorizedError extends ApplicationError {
  constructor(message = DefaultErrorMessages.UNAUTHORIZED) {
    super(message, 401, 'UnauthorizedError');
  }
}
