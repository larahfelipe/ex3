import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import { connectionDefinitions, globalIdField } from 'graphql-relay';

import type { User } from './UserModel';

const UserType = new GraphQLObjectType<User>({
  name: 'User',
  description: 'User Type',
  fields: () => ({
    id: globalIdField('User'),
    name: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (user) => user.name
    },
    email: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: (user) => user.email
    }
  })
});

const { connectionType: UserConnection, edgeType: UserEdge } =
  connectionDefinitions({
    nodeType: UserType
  });

export { UserType, UserConnection, UserEdge };
