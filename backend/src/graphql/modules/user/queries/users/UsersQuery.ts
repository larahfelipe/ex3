import { GraphQLNonNull, type GraphQLFieldConfig } from 'graphql';
import {
  connectionArgs,
  connectionFromArray,
  type ConnectionArguments
} from 'graphql-relay';

import { UnauthorizedError } from '@/errors';
import type { Context } from '@/types';

import { UserLoader } from '../../UserLoader';
import { UserConnection } from '../../UserType';

export const UsersQuery: GraphQLFieldConfig<any, Context, ConnectionArguments> =
  {
    type: new GraphQLNonNull(UserConnection),
    args: connectionArgs,
    resolve: async (_, args, ctx) => {
      if (!ctx.user) throw new UnauthorizedError(ctx.message);

      const userLoader = UserLoader.getInstance();

      const allUsersData = await userLoader.loadAll();

      return connectionFromArray(allUsersData, args);
    }
  };
