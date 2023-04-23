import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId } from 'graphql-relay';

import { NotFoundError, UnauthorizedError } from '@/errors';
import { PortfolioRepository, TransactionRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { DeleteTransactionSchema } from '@/validation/schema';

import type {
  DeleteTransactionResponse,
  InputPayload
} from './DeleteTransactionMutation.types';

export const DeleteTransactionMutation = mutationWithClientMutationId({
  name: 'DeleteTransaction',
  description: 'Delete a transaction',
  inputFields: {
    id: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    message: {
      type: GraphQLString,
      resolve: ({ message }: DeleteTransactionResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<DeleteTransactionResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioRepository = PortfolioRepository.getInstance();
    const transactionRepository = TransactionRepository.getInstance();

    const { id: validatedTransactionId } = await validate(
      DeleteTransactionSchema,
      input
    );

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists)
      throw new NotFoundError('Portfolio not found for this user');

    const transactionExists = await transactionRepository.getById(
      validatedTransactionId
    );

    if (!transactionExists)
      throw new NotFoundError('Transaction not found for this asset');

    await transactionRepository.delete(validatedTransactionId);

    const res: DeleteTransactionResponse = {
      message: 'Transaction deleted successfully'
    };

    return res;
  }
});
