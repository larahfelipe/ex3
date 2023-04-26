import { GraphQLError } from 'graphql';

import { DefaultErrorMessages } from '@/constants';

export class ForbiddenError extends GraphQLError {
  constructor(message?: string | null) {
    super(message ?? DefaultErrorMessages.FORBIDDEN, {
      extensions: {
        code: 'Forbidden',
        http: { status: 403 }
      }
    });
  }
}
