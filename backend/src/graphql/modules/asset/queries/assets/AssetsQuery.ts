import { GraphQLNonNull, type GraphQLFieldConfig } from 'graphql';
import {
  connectionArgs,
  connectionFromArray,
  type ConnectionArguments
} from 'graphql-relay';

import { PortfolioMessages } from '@/constants';
import { NotFoundError, UnauthorizedError } from '@/errors';
import { PortfolioRepository } from '@/infra/database';
import type { Context } from '@/types';

import { AssetLoader } from '../../AssetLoader';
import { AssetConnection } from '../../AssetType';

export const AssetsQuery: GraphQLFieldConfig<
  any,
  Context,
  ConnectionArguments
> = {
  description: 'Get all assets',
  type: new GraphQLNonNull(AssetConnection),
  args: connectionArgs,
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    let portfolioId: string | undefined;
    const assetLoader = AssetLoader.getInstance();

    if (!user.isStaff) {
      const portfolioRepository = PortfolioRepository.getInstance();

      const portfolioExists = await portfolioRepository.getByUserId(user.id);

      if (!portfolioExists)
        throw new NotFoundError(PortfolioMessages.NOT_FOUND);

      portfolioId = portfolioExists.id;
    }

    const allAssetsData = await assetLoader.loadAll(portfolioId);

    return connectionFromArray(allAssetsData, args);
  }
};
