import { DefaultErrorMessages } from '@/constants';

import { ApplicationError } from './ApplicationError';

export class NotFoundError extends ApplicationError {
  constructor(message = DefaultErrorMessages.NOT_FOUND) {
    super(message, 404, 'NotFoundError');
  }
}
