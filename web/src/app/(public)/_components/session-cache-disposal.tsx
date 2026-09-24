'use client';

import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

/**
 * Nothing cached for an account that left may reach the next one to sign in.
 * The cache is dropped once the protected pages have unmounted: dropping it
 * while their queries are still observed refetches them without a session.
 */
export function SessionCacheDisposal() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.clear();
  }, [queryClient]);

  return null;
}
