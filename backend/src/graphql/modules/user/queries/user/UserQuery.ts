import {
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfig
} from 'graphql';
import { connectionFromArray } from 'graphql-relay';

import { UserMessages } from '@/constants';
import { NotFoundError } from '@/errors';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { GetUserSchema } from '@/validation/schema';

import { UserLoader } from '../../UserLoader';
import { UserConnection } from '../../UserType';
import type { UserQueryArgs } from './UserQuery.types';

export const UserQuery: GraphQLFieldConfig<any, Context, UserQueryArgs> = {
  description: 'Get user by credentials',
  type: new GraphQLNonNull(UserConnection),
  args: {
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) }
  },
  resolve: async (_, args) => {
    const userLoader = UserLoader.getInstance();

    const validatedCredentials = await validate(GetUserSchema, args);

    const userData = await userLoader.loadByCredentials(validatedCredentials);
    if (!userData) throw new NotFoundError(UserMessages.NOT_FOUND);

    return connectionFromArray([userData], args);
  }
};
