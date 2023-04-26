import {
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from 'graphql';
import {
  connectionArgs,
  connectionDefinitions,
  globalIdField
} from 'graphql-relay';

import type { Asset } from '@/domain/models';

import { TransactionConnection } from '../transaction';
import { TransactionsQuery } from '../transaction/queries';

const AssetType = new GraphQLObjectType<Asset>({
  name: 'Asset',
  description: 'Asset Type',
  fields: () => ({
    id: globalIdField('Asset'),
    symbol: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ symbol }) => symbol
    },
    amount: {
      type: new GraphQLNonNull(GraphQLFloat),
      resolve: ({ amount }) => amount
    },
    balance: {
      type: new GraphQLNonNull(GraphQLFloat),
      resolve: ({ balance }) => balance
    },
    transactions: {
      type: TransactionConnection,
      args: connectionArgs,
      resolve: (...args) => (TransactionsQuery as any).resolve(...args)
    }
  })
});

const { connectionType: AssetConnection, edgeType: AssetEdge } =
  connectionDefinitions({
    nodeType: AssetType
  });

export { AssetType, AssetConnection, AssetEdge };
