import { GraphQLError } from 'graphql';

export class ForbiddenError extends GraphQLError {
  constructor(message: string | null) {
    super(message ?? 'Access denied', {
      extensions: {
        code: 'Forbidden',
        http: { status: 403 }
      }
    });
  }
}
