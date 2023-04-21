import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId } from 'graphql-relay';

import { envs } from '@/config';
import { BadRequestError, UnauthorizedError } from '@/errors';
import { Bcrypt } from '@/infra/cryptography';
import { PortfolioRepository, UserRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { DeleteUserSchema } from '@/validation/schema';

import type {
  DeleteUserResponse,
  InputPayload
} from './DeleteUserMutation.types';

export const DeleteUserMutation = mutationWithClientMutationId({
  name: 'DeleteUser',
  description: 'Delete an user',
  inputFields: {
    password: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    message: {
      type: GraphQLString,
      resolve: ({ message }: DeleteUserResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<DeleteUserResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);
    const portfolioRepository = PortfolioRepository.getInstance();
    const userRepository = UserRepository.getInstance();

    const { password: validatedPassword } = await validate(
      DeleteUserSchema,
      input
    );

    const isPasswordValid = await bcrypt.compare(
      validatedPassword,
      user.password
    );

    if (!isPasswordValid) throw new BadRequestError('Invalid password');

    await portfolioRepository.delete(user.id);

    await userRepository.delete(user.id);

    const res: DeleteUserResponse = {
      message: 'User deleted successfully'
    };

    return res;
  }
});
