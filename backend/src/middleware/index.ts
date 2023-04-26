import type { Request } from 'koa';
import { graphqlHTTP, type OptionsData } from 'koa-graphql';

import { envs } from '@/config';
import { DefaultErrorMessages, UserMessages } from '@/constants';
import type { User } from '@/domain/models';
import { schema } from '@/graphql/schema';
import { Jwt } from '@/infra/cryptography';
import { UserRepository } from '@/infra/database';
import type { Context } from '@/types';

const getContext = async (req: Request): Promise<Context> => {
  const { authorization } = req.headers;

  try {
    if (!authorization?.length) throw DefaultErrorMessages.INVALID_AUTH_HEADER;

    const [_, accessToken] = authorization.split(' ');

    const jwt = Jwt.getInstance(envs.jwtSecret);
    const userRepository = UserRepository.getInstance();

    const { id: decryptedAccessToken } = await jwt.decrypt(accessToken);
    if (!decryptedAccessToken) throw DefaultErrorMessages.INVALID_TOKEN;

    const userExists = await userRepository.getByAccessToken(accessToken);
    if (!userExists) throw UserMessages.NOT_FOUND;

    return { user: userExists as User, message: null };
  } catch (e) {
    const errorMessage = e as string;

    return { user: null, message: errorMessage };
  }
};

const graphQLOptions = async (req: Request): Promise<OptionsData> => ({
  schema,
  pretty: true,
  context: await getContext(req),
  customFormatErrorFn: ({ message, extensions, path }) => ({
    message,
    httpStatus: {
      code: (extensions?.http as Record<'status', 'string'>)?.status ?? 500,
      message: extensions?.code ?? DefaultErrorMessages.INTERNAL_SERVER_ERROR
    },
    path
  })
});

export const graphQLMiddleware = graphqlHTTP(graphQLOptions);
