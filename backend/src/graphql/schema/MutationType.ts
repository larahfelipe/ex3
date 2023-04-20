import { GraphQLObjectType } from 'graphql';

import {
  CreateUserMutation,
  DeleteUserMutation,
  UpdateUserMutation
} from '../modules/user';

export const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  description: 'The root of all mutations',
  fields: () => ({
    createUser: CreateUserMutation,
    deleteUser: DeleteUserMutation,
    updateUser: UpdateUserMutation
  })
});
