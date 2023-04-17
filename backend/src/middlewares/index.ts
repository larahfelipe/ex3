import type { Request } from 'koa';
import { graphqlHTTP, type OptionsData } from 'koa-graphql';

import { schema } from '@/graphql/schema';

const graphQlOptions = async (_: Request): Promise<OptionsData> => {
  return {
    schema,
    pretty: true
  };
};

export const graphQlMiddleware = graphqlHTTP(graphQlOptions);
