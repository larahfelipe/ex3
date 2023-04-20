import { GraphQLError } from 'graphql';

export class BadRequestError extends GraphQLError {
  constructor(message: string | null) {
    super(message ?? 'Invalid or corrupted request', {
      extensions: {
        code: 'Bad Request',
        http: { status: 400 }
      }
    });
  }
}
