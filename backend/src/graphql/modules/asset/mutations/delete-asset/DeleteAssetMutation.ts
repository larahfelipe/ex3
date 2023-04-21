import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId } from 'graphql-relay';

import { NotFoundError, UnauthorizedError } from '@/errors';
import { AssetRepository, PortfolioRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { DeleteAssetSchema } from '@/validation/schema';

import type {
  DeleteAssetResponse,
  InputPayload
} from './DeleteAssetMutation.types';

export const DeleteAssetMutation = mutationWithClientMutationId({
  name: 'DeleteAsset',
  description: 'Delete an asset by symbol',
  inputFields: {
    symbol: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    message: {
      type: GraphQLString,
      resolve: ({ message }: DeleteAssetResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<DeleteAssetResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioRepository = PortfolioRepository.getInstance();
    const assetRepository = AssetRepository.getInstance();

    const { symbol: validatedSymbol } = await validate(
      DeleteAssetSchema,
      input
    );

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists)
      throw new NotFoundError('Portfolio not found for this user');

    const assetExists = await assetRepository.getBySymbol({
      symbol: validatedSymbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists) throw new NotFoundError('Asset not found in portfolio');

    await assetRepository.delete({
      symbol: validatedSymbol,
      portfolioId: portfolioExists.id
    });

    const res: DeleteAssetResponse = {
      message: 'Asset deleted successfully'
    };

    return res;
  }
});
