'use client';

import { useCallback } from 'react';

import { useSearchParams } from 'next/navigation';

import { updateUrlQuery } from '@/common/utils';

const FIRST_PAGE = 1;

/**
 * The page lives in the query string, so a refresh or a shared link keeps it
 * and Back returns to the page before. Anything but a page number shows the
 * first page, and the first page leaves the parameter out.
 */
export const usePageParam = (name: string) => {
  const searchParams = useSearchParams();
  const requestedPage = Number(searchParams.get(name));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= FIRST_PAGE
      ? requestedPage
      : FIRST_PAGE;

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
