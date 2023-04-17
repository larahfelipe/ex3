import { GraphQLNonNull, GraphQLObjectType } from 'graphql';
import { connectionArgs, connectionFromArray } from 'graphql-relay';

import { loadAll } from '../user/UserLoader';
import { UserConnection } from '../user/UserType';

export const QueryType = new GraphQLObjectType({
  name: 'Query',
  description: 'The root of all queries',
  fields: () => ({
    users: {
      type: new GraphQLNonNull(UserConnection),
      args: connectionArgs,
      resolve: async (_, args, ctx) => {
        const data = await loadAll();

        return connectionFromArray(data, args);
      }
    }
  })
});
