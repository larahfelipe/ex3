import { GraphQLFloat, GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import type { Transaction, TransactionType } from '@/domain/models';
import { NotFoundError, UnauthorizedError } from '@/errors';
import {
  AssetRepository,
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { CreateTransactionSchema } from '@/validation/schema';

import { TransactionEdge } from '../../TransactionType';
import type {
  CreateTransactionResponse,
  InputPayload
} from './CreateTransactionMutation.types';

export const CreateTransactionMutation = mutationWithClientMutationId({
  name: 'CreateTransaction',
  description: 'Create a new transaction',
  inputFields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: new GraphQLNonNull(GraphQLFloat) },
    price: { type: new GraphQLNonNull(GraphQLFloat) },
    assetId: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    transactionEdge: {
      type: TransactionEdge,
      resolve: ({ transaction }: CreateTransactionResponse) => {
        if (!transaction) return null;

        return {
          cursor: toGlobalId('Transaction', transaction.id),
          node: transaction
        };
      }
    },
    message: {
      type: GraphQLString,
      resolve: ({ message }: CreateTransactionResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<CreateTransactionResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioRepository = PortfolioRepository.getInstance();
    const assetRepository = AssetRepository.getInstance();
    const transactionRepository = TransactionRepository.getInstance();

    const {
      type: validatedTransactionType,
      amount: validatedTransactionAmount,
      price: validatedTransactionPrice,
      assetId: validatedTransactionAssetId
    } = await validate(CreateTransactionSchema, input);

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists)
      throw new NotFoundError('Portfolio not found for this user');

    const assetExists = await assetRepository.getById(
      validatedTransactionAssetId
    );

    if (!assetExists)
      throw new NotFoundError('Asset not found in portfolio. Create it first');

    const newTransaction = await transactionRepository.add({
      type: validatedTransactionType as TransactionType,
      amount: validatedTransactionAmount,
      price: validatedTransactionPrice,
      assetId: validatedTransactionAssetId
    });

    const res: CreateTransactionResponse = {
      transaction: newTransaction as Transaction,
      message: 'Transaction created successfully'
    };

    return res;
  }
});
