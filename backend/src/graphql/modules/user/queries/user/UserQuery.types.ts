import type { ConnectionArguments } from 'graphql-relay';

import type { User } from '@/domain/models';

export type UserQueryArgs = ConnectionArguments &
  Pick<User, 'email' | 'password'>;
