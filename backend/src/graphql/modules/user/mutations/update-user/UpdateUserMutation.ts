import { GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import { envs } from '@/config';
import { BadRequestError, UnauthorizedError } from '@/errors';
import { Bcrypt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';
import type { Context } from '@/types';

import { UserEdge } from '../../UserType';
import type {
  InputPayload,
  UpdateUserResponse
} from './UpdateUserMutation.types';

export const UpdateUserMutation = mutationWithClientMutationId({
  name: 'UpdateUser',
  description: 'Update an existing user',
  inputFields: {
    name: { type: GraphQLString },
    oldPassword: { type: GraphQLString },
    newPassword: { type: GraphQLString }
  },
  outputFields: {
    userEdge: {
      type: UserEdge,
      resolve: ({ user }: UpdateUserResponse) => {
        if (!user) return null;

        return {
          cursor: toGlobalId('User', user.id),
          node: user
        };
      }
    },
    message: {
      type: GraphQLString,
      resolve: ({ message }: UpdateUserResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload,
    ctx: Context
  ): Promise<UpdateUserResponse> => {
    const { user, message } = ctx;
    if (!user) throw new UnauthorizedError(message);

    const { name, oldPassword, newPassword } = input;

    let res: UpdateUserResponse = {
      user: null,
      message: null
    };

    const bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);
    const userRepository = UserRepository.getInstance();

    let isPasswordValid = false;

    if (oldPassword?.length) {
      isPasswordValid = await bcrypt.compare(oldPassword, user.password);

      if (!isPasswordValid || !newPassword?.length)
        throw new BadRequestError('Invalid password');
    }

    const updatedUser = await userRepository.update({
      id: user.id,
      name,
      password: isPasswordValid ? newPassword : null
    });

    res = {
      user: updatedUser,
      message: 'User updated successfully'
    };

    return res;
  }
});
