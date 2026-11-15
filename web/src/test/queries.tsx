import type { ReactNode } from 'react';

import {
  QueryClient,
  QueryClientProvider,
  type QueryKey
} from '@tanstack/react-query';

export const withQueryData = (
  responses: ReadonlyArray<readonly [QueryKey, unknown]>,
  node: ReactNode
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } }
  });

  for (const [queryKey, data] of responses)
    queryClient.setQueryData(queryKey, { data });

  return <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>;
};
