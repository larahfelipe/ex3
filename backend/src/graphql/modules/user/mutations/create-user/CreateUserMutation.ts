import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import { envs } from '@/config';
import { BadRequestError } from '@/errors';
import { Jwt } from '@/infra/cryptography';
import { PortfolioRepository, UserRepository } from '@/infra/database';

import { UserEdge } from '../../UserType';
import type {
  CreateUserResponse,
  InputPayload
} from './CreateUserMutation.types';

export const CreateUserMutation = mutationWithClientMutationId({
  name: 'CreateUser',
  description: 'Create a new user',
  inputFields: {
    name: { type: GraphQLString },
    email: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) }
  },
  outputFields: {
    userEdge: {
      type: UserEdge,
      resolve: ({ user }: CreateUserResponse) => {
        if (!user) return null;

        return {
          cursor: toGlobalId('User', user.id),
          node: user
        };
      }
    },
    message: {
      type: GraphQLString,
      resolve: ({ message }: CreateUserResponse) => message
    }
  },
  mutateAndGetPayload: async (
    input: InputPayload
  ): Promise<CreateUserResponse> => {
    const { name, email, password } = input;

    let res: CreateUserResponse = {
      user: null,
      message: null
    };

    const userRepository = UserRepository.getInstance();
    const portfolioRepository = PortfolioRepository.getInstance();
    const jwt = Jwt.getInstance(envs.jwtSecret);

    const userAlreadyExists = await userRepository.getByEmail(email);

    if (userAlreadyExists) throw new BadRequestError('User already exists');

    const newUser = await userRepository.add({ name, email, password });

    const encryptedAccessToken = await jwt.encrypt(newUser.id);

    await userRepository.updateAccessToken({
      id: newUser.id,
      accessToken: encryptedAccessToken
    });

    await portfolioRepository.add(newUser.id);

    res = {
      user: {
        ...newUser,
        accessToken: encryptedAccessToken
      },
      message: 'User created successfully'
    };

    return res;
  }
});
