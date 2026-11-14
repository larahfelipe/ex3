import type { Maybe } from '@/types';

export const FIRST_PAGE = 1;

export const pageNumberFrom = (value: Maybe<string>) => {
  const page = Number(value);

  return Number.isSafeInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE;
};
