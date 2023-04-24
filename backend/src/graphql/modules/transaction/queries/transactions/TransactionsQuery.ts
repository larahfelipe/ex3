import {
  GraphQLNonNull,
  GraphQLString,
  type GraphQLFieldConfig
} from 'graphql';
import { connectionFromArray } from 'graphql-relay';

import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/errors';
import { AssetRepository, PortfolioRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { GetTransactionsSchema } from '@/validation/schema';

import { TransactionLoader } from '../../TransactionLoader';
import { TransactionConnection } from '../../TransactionType';
import type { TransactionsQueryArgs } from './TransactionsQuery.types';

export const TransactionsQuery: GraphQLFieldConfig<
  any,
  Context,
  TransactionsQueryArgs
> = {
  description: 'Get transaction by asset id',
  type: new GraphQLNonNull(TransactionConnection),
  args: {
    assetId: { type: GraphQLString }
  },
  resolve: async (_, args, ctx) => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);
    if (!user.isStaff && !args?.assetId?.length)
      throw new ForbiddenError(
        "You don't have permission to access this resource"
      );

    const transactionLoader = TransactionLoader.getInstance();

    const { assetId: validatedAssetId } = await validate(
      GetTransactionsSchema,
      args
    );

    if (!user.isStaff) {
      const portfolioRepository = PortfolioRepository.getInstance();
      const assetRepository = AssetRepository.getInstance();

      const portfolioExists = await portfolioRepository.getByUserId(user.id);

      if (!portfolioExists)
        throw new NotFoundError('Portfolio not found for this user');

      const allAssets = await assetRepository.getAllByPortfolioId(
        portfolioExists.id
      );

      if (!allAssets?.length)
        throw new NotFoundError('No assets found for this portfolio');

      const assetExists = allAssets.find(
        (asset) => asset.id === validatedAssetId
      );

      if (!assetExists)
        throw new NotFoundError(
          'Asset not found in portfolio for the given id'
        );
    }

    const allTransactionsData = await transactionLoader.loadAll(
      validatedAssetId
    );

    return connectionFromArray(allTransactionsData, args);
  }
};
