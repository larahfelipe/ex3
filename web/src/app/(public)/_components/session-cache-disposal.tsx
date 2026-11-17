'use client';

import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

export function SessionCacheDisposal() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.clear();
  }, [queryClient]);

  return null;
}
