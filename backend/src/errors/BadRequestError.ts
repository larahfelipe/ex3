import { GraphQLError } from 'graphql';

import { DefaultErrorMessages } from '@/constants';

export class BadRequestError extends GraphQLError {
  constructor(message?: string | null) {
    super(message ?? DefaultErrorMessages.BAD_REQUEST, {
      extensions: {
        code: 'Bad Request',
        http: { status: 400 }
      }
    });
  }
}
