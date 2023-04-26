import { GraphQLError } from 'graphql';

import { DefaultErrorMessages } from '@/constants';

export class UnauthorizedError extends GraphQLError {
  constructor(message?: string | null) {
    super(message ?? DefaultErrorMessages.UNAUTHORIZED, {
      extensions: {
        code: 'Unauthorized',
        http: { status: 401 }
      }
    });
  }
}
