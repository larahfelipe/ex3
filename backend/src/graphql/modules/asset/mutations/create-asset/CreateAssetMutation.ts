import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import type { Asset } from '@/domain/models';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@/errors';
import { AssetRepository, PortfolioRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { CreateAssetSchema } from '@/validation/schema';

import { AssetEdge } from '../../AssetType';
import type {
  CreateAssetResponse,
  InputPayload
} from './CreateAssetMutation.types';

export const CreateAssetMutation = mutationWithClientMutationId({
  name: 'CreateAsset',
  description: 'Create a new asset',
  inputFields: {
    symbol: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    assetEdge: {
      type: AssetEdge,
      resolve: ({ asset }: CreateAssetResponse) => {
        if (!asset) return null;

        return {
          cursor: toGlobalId('Asset', asset.id),
          node: asset
        };
      }
    },
    message: {
      type: GraphQLString,
      resolve: ({ message }: CreateAssetResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<CreateAssetResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const portfolioRepository = PortfolioRepository.getInstance();
    const assetRepository = AssetRepository.getInstance();

    const { symbol: validatedSymbol } = await validate(
      CreateAssetSchema,
      input
    );

    const portfolioExists = await portfolioRepository.getByUserId(user.id);

    if (!portfolioExists)
      throw new NotFoundError('Portfolio not found for this user');

    const assetAlreadyExists = await assetRepository.getBySymbol({
      symbol: validatedSymbol,
      portfolioId: portfolioExists.id
    });

    if (assetAlreadyExists)
      throw new BadRequestError(
        'Asset already exists in portfolio. Update it instead'
      );

    const newAsset = await assetRepository.add({
      symbol: validatedSymbol,
      portfolioId: portfolioExists.id
    });

    const res: CreateAssetResponse = {
      asset: newAsset as Asset,
      message: 'Asset created successfully'
    };

    return res;
  }
});
