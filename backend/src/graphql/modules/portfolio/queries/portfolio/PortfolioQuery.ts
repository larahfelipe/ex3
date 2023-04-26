import { GraphQLNonNull, type GraphQLFieldConfig } from 'graphql';
import { connectionFromArray, type ConnectionArguments } from 'graphql-relay';

import { PortfolioMessages } from '@/constants';
import { NotFoundError, UnauthorizedError } from '@/errors';
import type { Context } from '@/types';

import { PortfolioLoader } from '../../PortfolioLoader';
import { PortfolioConnection } from '../../PortfolioType';

export const PortfolioQuery: GraphQLFieldConfig<
  any,
  Context,
  ConnectionArguments
> = {
  description: 'Get user portfolio',
  type: new GraphQLNonNull(PortfolioConnection),
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioLoader = PortfolioLoader.getInstance();

    const portfolioData = await portfolioLoader.loadByUserId(user.id);

    if (!portfolioData) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    return connectionFromArray([portfolioData], args);
  }
};
