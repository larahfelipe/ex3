import { GraphQLError } from 'graphql';

import { DefaultErrorMessages } from '@/constants';

export class NotFoundError extends GraphQLError {
  constructor(message?: string | null) {
    super(message ?? DefaultErrorMessages.NOT_FOUND, {
      extensions: {
        code: 'Not Found',
        http: { status: 404 }
      }
    });
  }
}
