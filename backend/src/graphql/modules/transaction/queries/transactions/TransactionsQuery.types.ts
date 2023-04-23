import type { ConnectionArguments } from 'graphql-relay';

export type TransactionsQueryArgs = ConnectionArguments & {
  assetId: string;
};
