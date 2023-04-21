import { GraphQLNonNull, type GraphQLFieldConfig } from 'graphql';
import {
  connectionArgs,
  connectionFromArray,
  type ConnectionArguments
} from 'graphql-relay';

import { UnauthorizedError } from '@/errors';
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
    if (!ctx?.user) throw new UnauthorizedError(ctx.message);

    const assetLoader = AssetLoader.getInstance();

    const allAssets = await assetLoader.loadAll();

    return connectionFromArray(allAssets, args);
  }
};
