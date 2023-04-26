import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId } from 'graphql-relay';

import { PortfolioMessages, TransactionMessages } from '@/constants';
import { NotFoundError, UnauthorizedError } from '@/errors';
import {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
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
    const assetRepository = AssetRepository.getInstance();

    const { id: validatedTransactionId } = await validate(
      DeleteTransactionSchema,
      input
    );

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const transactionExists = await transactionRepository.getById(
      validatedTransactionId
    );

    if (!transactionExists)
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    await transactionRepository.delete(validatedTransactionId);

    await assetRepository.updatePosition({
      operation: 'decrement',
      amount: transactionExists.amount,
      balance: transactionExists.price * transactionExists.amount,
      id: transactionExists.assetId
    });

    const res: DeleteTransactionResponse = {
      message: TransactionMessages.DELETED
    };

    return res;
  }
});
