import { GraphQLNonNull, type GraphQLFieldConfig } from 'graphql';
import {
  connectionArgs,
  connectionFromArray,
  type ConnectionArguments
} from 'graphql-relay';

import { ForbiddenError, UnauthorizedError } from '@/errors';
import type { Context } from '@/types';

import { UserLoader } from '../../UserLoader';
import { UserConnection } from '../../UserType';

export const UsersQuery: GraphQLFieldConfig<any, Context, ConnectionArguments> =
  {
    description: 'Get all users',
    type: new GraphQLNonNull(UserConnection),
    args: connectionArgs,
    resolve: async (_, args, ctx) => {
      const { user, message } = ctx;
      if (!user) throw new UnauthorizedError(message);
      if (!user.isStaff) throw new ForbiddenError();

      const userLoader = UserLoader.getInstance();

      const allUsersData = await userLoader.loadAll();

      return connectionFromArray(allUsersData, args);
    }
  };
