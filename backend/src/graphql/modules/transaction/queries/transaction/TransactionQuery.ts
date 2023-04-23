import {
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfig
} from 'graphql';
import { connectionFromArray } from 'graphql-relay';

import { NotFoundError, UnauthorizedError } from '@/errors';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { GetTransactionSchema } from '@/validation/schema';

import { TransactionLoader } from '../../TransactionLoader';
import { TransactionType } from '../../TransactionType';
import type { TransactionQueryArgs } from './TransactionQuery.types';

export const TransactionQuery: GraphQLFieldConfig<
  any,
  Context,
  TransactionQueryArgs
> = {
  description: 'Get transaction by id',
  type: new GraphQLNonNull(TransactionType),
  args: {
    id: { type: new GraphQLNonNull(GraphQLString) }
  },
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const transactionLoader = TransactionLoader.getInstance();

    const { id: validatedTransactionId } = await validate(
      GetTransactionSchema,
      args
    );

    const transactionData = await transactionLoader.loadById(
      validatedTransactionId
    );

    if (!transactionData)
      throw new NotFoundError('Transaction not found for the given id');

    return connectionFromArray([transactionData], args);
  }
};
