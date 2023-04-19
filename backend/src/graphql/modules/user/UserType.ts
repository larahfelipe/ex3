import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import { connectionDefinitions, globalIdField } from 'graphql-relay';

import type { User } from '@/domain/models';

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
    createdAt: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ createdAt }) => createdAt
    },
    updatedAt: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ updatedAt }) => updatedAt
    }
    // portfolio: {
    //   type: new GraphQLObjectType({
    //     name: 'Portfolio',
    //     description: 'Portfolio Type',
    //     fields: () => ({
    //       id: globalIdField('Portfolio'),
    //       assets: {
    //         type: new GraphQLNonNull(GraphQLString),
    //         resolve: ({ assets }) => assets
    //       },
    //       message: {
    //         type: new GraphQLNonNull(GraphQLString),
    //         resolve: ({ message }) => message
    //       }
    //     })
    //   }),
    //   resolve: ({ portfolio }) => ({
    //     ...portfolio,
    //     message: 'Portfolio here'
    //   })
    // },
  })
});

const { connectionType: UserConnection, edgeType: UserEdge } =
  connectionDefinitions({
    nodeType: UserType
  });

export { UserType, UserConnection, UserEdge };
