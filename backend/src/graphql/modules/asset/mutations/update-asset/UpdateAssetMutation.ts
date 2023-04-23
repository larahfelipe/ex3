import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId } from 'graphql-relay';

import { BadRequestError, NotFoundError, UnauthorizedError } from '@/errors';
import { AssetRepository, PortfolioRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { UpdateAssetSchema } from '@/validation/schema';

import type {
  InputPayload,
  UpdateAssetResponse
} from './UpdateAssetMutation.types';

export const UpdateAssetMutation = mutationWithClientMutationId({
  name: 'UpdateAsset',
  description: 'Update an asset',
  inputFields: {
    oldSymbol: { type: new GraphQLNonNull(GraphQLString) },
    newSymbol: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    message: {
      type: GraphQLString,
      resolve: ({ message }: UpdateAssetResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<UpdateAssetResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioRepository = PortfolioRepository.getInstance();
    const assetRepository = AssetRepository.getInstance();

    const { oldSymbol: validatedOldSymbol, newSymbol: validatedNewSymbol } =
      await validate(UpdateAssetSchema, input);

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists)
      throw new NotFoundError('Portfolio not found for this user');

    const assetExists = await assetRepository.getBySymbol({
      symbol: validatedOldSymbol,
      portfolioId: portfolioExists.id
    });

    if (!assetExists)
      throw new NotFoundError('Asset not found in portfolio. Create it first');

    const assetAlreadyExists = await assetRepository.getBySymbol({
      symbol: validatedNewSymbol,
      portfolioId: portfolioExists.id
    });

    if (assetAlreadyExists)
      throw new BadRequestError('Asset already exists in portfolio');

    await assetRepository.update({
      oldSymbol: validatedOldSymbol,
      newSymbol: validatedNewSymbol,
      portfolioId: portfolioExists.id
    });

    const res: UpdateAssetResponse = {
      message: 'Asset updated successfully'
    };

    return res;
  }
});
