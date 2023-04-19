import { GraphQLNonNull, GraphQLString } from 'graphql';
import { mutationWithClientMutationId, toGlobalId } from 'graphql-relay';

import type { User } from '@/domain/models';
import { PortfolioRepository, UserRepository } from '@/infra/database';

import { UserEdge } from '../../UserType';
import type { CreateUserResponse } from './CreateUserMutation.types';

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
    success: {
      type: GraphQLString,
      resolve: ({ success }: CreateUserResponse) => success
    },
    error: {
      type: GraphQLString,
      resolve: ({ error }: CreateUserResponse) => error
    }
  },
  mutateAndGetPayload: async (input: User): Promise<CreateUserResponse> => {
    const { name, email, password } = input;

    let res: CreateUserResponse = {
      user: null,
      success: null,
      error: null
    };

    const userRepository = UserRepository.getInstance();
    const portfoliosRepository = PortfolioRepository.getInstance();

    const userAlreadyExists = await userRepository.getByEmail(email);

    if (userAlreadyExists) {
      res.error = 'User already exists';
      return res;
    }

    const user = await userRepository.add({ name, email, password });

    await portfoliosRepository.add(user.id);

    res = {
      user,
      error: null,
      success: 'User created successfully'
    };

    return res;
  }
});
