import type { ConnectionArguments } from 'graphql-relay';

export type TransactionQueryArgs = ConnectionArguments & {
  id: string;
};
