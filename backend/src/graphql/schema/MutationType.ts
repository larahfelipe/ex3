import { GraphQLObjectType } from 'graphql';

import { CreateUserMutation } from '../modules/user';

export const MutationType = new GraphQLObjectType({
  name: 'Mutation',
  description: 'The root of all mutations',
  fields: () => ({
    createUser: CreateUserMutation
  })
});
