import { GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import {
  connectionArgs,
  connectionDefinitions,
  globalIdField
} from 'graphql-relay';

import type { Asset } from '@/domain/models';

import { TransactionConnection } from '../transaction';

const AssetType = new GraphQLObjectType<Asset>({
  name: 'Asset',
  description: 'Asset Type',
  fields: () => ({
    id: globalIdField('Asset'),
    symbol: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ symbol }) => symbol
    },
    transactions: {
      type: TransactionConnection,
      args: connectionArgs,
      resolve: ({ transactions }) => transactions
    }
  })
});

const { connectionType: AssetConnection, edgeType: AssetEdge } =
  connectionDefinitions({
    nodeType: AssetType
  });

export { AssetType, AssetConnection, AssetEdge };
