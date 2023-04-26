import { GraphQLNonNull, type GraphQLFieldConfig } from 'graphql';
import {
  connectionArgs,
  connectionFromArray,
  type ConnectionArguments
} from 'graphql-relay';

import { ForbiddenError, UnauthorizedError } from '@/errors';
import type { Context } from '@/types';

import { PortfolioLoader } from '../../PortfolioLoader';
import { PortfolioConnection } from '../../PortfolioType';

export const PortfoliosQuery: GraphQLFieldConfig<
  any,
  Context,
  ConnectionArguments
> = {
  description: 'Get all portfolios',
  type: new GraphQLNonNull(PortfolioConnection),
  args: connectionArgs,
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);
    if (!user.isStaff) throw new ForbiddenError();

    const portfolioLoader = PortfolioLoader.getInstance();

    const allPortfoliosData = await portfolioLoader.loadAll();

    return connectionFromArray(allPortfoliosData, args);
  }
};
