import { DefaultErrorMessages } from '@/config';

import { ApplicationError } from './ApplicationError';

export class BadRequestError extends ApplicationError {
  constructor(message = DefaultErrorMessages.BAD_REQUEST) {
    super(message, 400, 'BadRequestError');
  }
}
