import { GraphQLError } from 'graphql';

export class NotFoundError extends GraphQLError {
  constructor(message: string | null) {
    super(message ?? 'Resource not found', {
      extensions: {
        code: 'Not Found',
        http: { status: 404 }
      }
    });
  }
}
