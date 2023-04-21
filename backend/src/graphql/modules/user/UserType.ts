import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import {
  connectionArgs,
  connectionDefinitions,
  globalIdField
} from 'graphql-relay';

import type { User } from '@/domain/models';

import { PortfolioConnection } from '../portfolio';

const UserType = new GraphQLObjectType<User>({
  name: 'User',
  description: 'User Type',
  fields: () => ({
    id: globalIdField('User'),
    name: {
      type: GraphQLString,
      resolve: ({ name }) => name
    },
    email: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ email }) => email
    },
    password: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ password }) => password
    },
    accessToken: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ accessToken }) => accessToken
    },
    portfolio: {
      type: PortfolioConnection,
      args: connectionArgs,
      resolve: ({ portfolio }) => portfolio
    },
    createdAt: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ createdAt }) => createdAt
    },
    updatedAt: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ updatedAt }) => updatedAt
    }
  })
});

const { connectionType: UserConnection, edgeType: UserEdge } =
  connectionDefinitions({
    nodeType: UserType
  });

export { UserType, UserConnection, UserEdge };
