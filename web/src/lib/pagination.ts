import type { Maybe } from '@/types';

/** The API numbers pages from one. */
export const FIRST_PAGE = 1;

/** Anything but a page number, such as a hand-edited query string, reads as the first page. */
export const pageNumberFrom = (value: Maybe<string>) => {
  const page = Number(value);

  return Number.isSafeInteger(page) && page >= FIRST_PAGE ? page : FIRST_PAGE;
};
