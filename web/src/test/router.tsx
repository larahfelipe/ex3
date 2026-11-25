import type { ReactNode } from 'react';

import {
  AppRouterContext,
  type AppRouterInstance
} from 'next/dist/shared/lib/app-router-context.shared-runtime';

const ROUTER: AppRouterInstance = {
  bfcacheId: 'test',
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined
};

export const withRouter = (node: ReactNode) => (
  <AppRouterContext value={ROUTER}>{node}</AppRouterContext>
);
