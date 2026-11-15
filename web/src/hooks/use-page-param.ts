'use client';

import { useCallback } from 'react';

import { useSearchParams } from 'next/navigation';

import { updateUrlQuery } from '@/common/utils';
import { FIRST_PAGE, pageNumberFrom } from '@/lib/pagination';

export const usePageParam = (name: string) => {
  const searchParams = useSearchParams();
  const page = pageNumberFrom(searchParams.get(name));

  const goToPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams);

      if (nextPage === FIRST_PAGE) params.delete(name);
      else params.set(name, String(nextPage));

      updateUrlQuery(params);
    },
    [name, searchParams]
  );

  return [page, goToPage] as const;
};
