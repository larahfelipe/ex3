import { GraphQLFloat, GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import type { Transaction, TransactionType } from '@/domain/models';
import { NotFoundError, UnauthorizedError } from '@/errors';
import { PortfolioRepository, TransactionRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { UpdateTransactionSchema } from '@/validation/schema/transaction/UpdateTransactionSchema';

import { TransactionEdge } from '../../TransactionType';
import type {
  InputPayload,
  UpdateTransactionResponse
} from './UpdateTransactionMutation.types';

export const UpdateTransactionMutation = mutationWithClientMutationId({
  name: 'UpdateTransaction',
  description: 'Update a transaction',
  inputFields: {
    id: { type: new GraphQLNonNull(GraphQLString) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: new GraphQLNonNull(GraphQLFloat) },
    price: { type: new GraphQLNonNull(GraphQLFloat) }
  },
  outputFields: {
    transactionEdge: {
      type: TransactionEdge,
      resolve: ({ transaction }: UpdateTransactionResponse) => {
        if (!transaction) return null;

        return {
          cursor: toGlobalId('Transaction', transaction.id),
          node: transaction
        };
      }
    },
    message: {
      type: GraphQLString,
      resolve: ({ message }: UpdateTransactionResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<UpdateTransactionResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioRepository = PortfolioRepository.getInstance();
    const transactionRepository = TransactionRepository.getInstance();

    const {
      id: validatedTransactionId,
      type: validatedTransactionType,
      amount: validatedTransactionAmount,
      price: validatedTransactionPrice
    } = await validate(UpdateTransactionSchema, input);

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists)
      throw new NotFoundError('Portfolio not found for this user');

    const transactionExists = await transactionRepository.getById(
      validatedTransactionId
    );

    if (!transactionExists)
      throw new NotFoundError(
        'Transaction not found for this asset. Create it first'
      );

    const updatedTransaction = await transactionRepository.update({
      id: validatedTransactionId,
      type: validatedTransactionType as TransactionType,
      amount: validatedTransactionAmount,
      price: validatedTransactionPrice
    });

    const res: UpdateTransactionResponse = {
      transaction: updatedTransaction as Transaction,
      message: 'Transaction updated successfully'
    };

    return res;
  }
});
