import { GraphQLObjectType } from 'graphql';

import { AssetQuery, AssetsQuery } from '../modules/asset/queries';
import { PortfolioQuery, PortfoliosQuery } from '../modules/portfolio/queries';
import {
  TransactionQuery,
  TransactionsQuery
} from '../modules/transaction/queries';
import { UserQuery, UsersQuery } from '../modules/user/queries';

export const QueryType = new GraphQLObjectType({
  name: 'Query',
  description: 'The root of all queries',
  fields: () => ({
    asset: AssetQuery,
    assets: AssetsQuery,
    portfolio: PortfolioQuery,
    portfolios: PortfoliosQuery,
    transaction: TransactionQuery,
    transactions: TransactionsQuery,
    user: UserQuery,
    users: UsersQuery
  })
});
