import {
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfig
} from 'graphql';
import { connectionFromArray } from 'graphql-relay';

import { AssetMessages, PortfolioMessages } from '@/constants';
import { NotFoundError, UnauthorizedError } from '@/errors';
import { PortfolioRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { GetAssetSchema } from '@/validation/schema';

import { AssetLoader } from '../../AssetLoader';
import { AssetConnection } from '../../AssetType';
import type { AssetQueryArgs } from './AssetQuery.types';

export const AssetQuery: GraphQLFieldConfig<any, Context, AssetQueryArgs> = {
  description: 'Get asset by symbol',
  type: new GraphQLNonNull(AssetConnection),
  args: {
    symbol: { type: new GraphQLNonNull(GraphQLString) }
  },
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const assetLoader = AssetLoader.getInstance();
    const portfolioRepository = PortfolioRepository.getInstance();

    const { symbol: validatedAssetSymbol } = await validate(
      GetAssetSchema,
      args
    );

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const assetData = await assetLoader.loadBySymbol({
      symbol: validatedAssetSymbol,
      portfolioId: portfolioExists.id
    });

    if (!assetData) throw new NotFoundError(AssetMessages.NOT_FOUND);

    return connectionFromArray([assetData], args);
  }
};
