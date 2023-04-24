import {
  GraphQLFloat,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString
} from 'graphql';
import { connectionDefinitions, globalIdField } from 'graphql-relay';

import type { Transaction } from '@/domain/models';

const TransactionType = new GraphQLObjectType<Transaction>({
  name: 'Transaction',
  description: 'Transaction Type',
  fields: () => ({
    id: globalIdField('Transaction'),
    type: {
      type: new GraphQLNonNull(GraphQLString),
      resolve: ({ type }) => type
    },
    amount: {
      type: new GraphQLNonNull(GraphQLFloat),
      resolve: ({ amount }) => amount
    },
    price: {
      type: new GraphQLNonNull(GraphQLFloat),
      resolve: ({ price }) => price
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

const { connectionType: TransactionConnection, edgeType: TransactionEdge } =
  connectionDefinitions({
    nodeType: TransactionType
  });

export { TransactionType, TransactionConnection, TransactionEdge };
