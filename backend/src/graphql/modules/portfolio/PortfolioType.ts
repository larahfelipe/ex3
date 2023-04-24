import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import {
  connectionArgs,
  connectionDefinitions,
  globalIdField
} from 'graphql-relay';

import type { Portfolio } from '@/domain/models';

import { AssetConnection } from '../asset';
import { AssetsQuery } from '../asset/queries';

const PortfolioType = new GraphQLObjectType<Portfolio>({
  name: 'Portfolio',
  description: 'Portfolio Type',
  fields: () => ({
    id: globalIdField('Portfolio'),
    userId: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ userId }) => userId
    },
    assets: {
      type: AssetConnection,
      args: connectionArgs,
      resolve: (...args) => (AssetsQuery as any).resolve(...args)
    }
  })
});

const { connectionType: PortfolioConnection, edgeType: PortfolioEdge } =
  connectionDefinitions({
    nodeType: PortfolioType
  });

export { PortfolioType, PortfolioConnection, PortfolioEdge };
