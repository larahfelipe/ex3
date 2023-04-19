import { GraphQLObjectType } from 'graphql';

import { UserQuery, UsersQuery } from '../modules/user';

export const QueryType = new GraphQLObjectType({
  name: 'Query',
  description: 'The root of all queries',
  fields: () => ({
    user: UserQuery,
    users: UsersQuery
  })
});
