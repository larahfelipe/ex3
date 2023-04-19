import { GraphQLError } from 'graphql';

export class UnauthorizedError extends GraphQLError {
  constructor(message: string | null) {
    super(message ?? 'Access denied', {
      extensions: {
        code: 'Unauthorized',
        http: { status: 401 }
      }
    });
  }
}
