import { GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import { envs } from '@/config';
import type { User } from '@/domain/models';
import { BadRequestError, UnauthorizedError } from '@/errors';
import { Bcrypt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';
import type { Context } from '@/types';
import { validate } from '@/validation';
import { UpdateUserSchema } from '@/validation/schema';

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

    const bcrypt = Bcrypt.getInstance(+envs.bcryptSalt);
    const userRepository = UserRepository.getInstance();

    let isPasswordValid = false;

    if (oldPassword?.length) {
      const {
        oldPassword: validatedOldPassword,
        newPassword: validatedNewPassword
      } = await validate(UpdateUserSchema, input);

      isPasswordValid = await bcrypt.compare(
        validatedOldPassword as string,
        user.password
      );

      if (!isPasswordValid) throw new BadRequestError('Invalid password');

      input.newPassword = validatedNewPassword as string;
    }

    const updatedUser = await userRepository.update({
      id: user.id,
      name: name ?? '',
      password: isPasswordValid ? newPassword : null
    });

    const res: UpdateUserResponse = {
      user: updatedUser as User,
      message: 'User updated successfully'
    };

    return res;
  }
});
