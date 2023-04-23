import {
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfig
} from 'graphql';
import { connectionFromArray } from 'graphql-relay';

import { UnauthorizedError } from '@/errors';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { GetTransactionsSchema } from '@/validation/schema';

import { TransactionLoader } from '../../TransactionLoader';
import { TransactionType } from '../../TransactionType';
import type { TransactionsQueryArgs } from './TransactionsQuery.types';

export const TransactionsQuery: GraphQLFieldConfig<
  any,
  Context,
  TransactionsQueryArgs
> = {
  description: 'Get transaction by asset id',
  type: new GraphQLNonNull(TransactionType),
  args: {
    assetId: { type: new GraphQLNonNull(GraphQLString) }
  },
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const transactionLoader = TransactionLoader.getInstance();

    const { assetId: validatedAssetId } = await validate(
      GetTransactionsSchema,
      args
    );

    const allTransactionsData = await transactionLoader.loadByAssetId(
      validatedAssetId
    );

    return connectionFromArray(allTransactionsData, args);
  }
};
