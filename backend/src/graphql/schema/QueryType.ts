import { GraphQLObjectType } from 'graphql';

import { AssetQuery, AssetsQuery } from '../modules/asset/queries';
import { PortfolioQuery, PortfoliosQuery } from '../modules/portfolio/queries';
import { UserQuery, UsersQuery } from '../modules/user/queries';

export const QueryType = new GraphQLObjectType({
  name: 'Query',
  description: 'The root of all queries',
  fields: () => ({
    asset: AssetQuery,
    assets: AssetsQuery,
    portfolio: PortfolioQuery,
    portfolios: PortfoliosQuery,
    user: UserQuery,
    users: UsersQuery
  })
});
