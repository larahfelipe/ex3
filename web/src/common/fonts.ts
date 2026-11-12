import { Inter, Raleway } from 'next/font/google';

/**
 * Both load as variable fonts, one file per subset for every weight, so
 * semibold renders true instead of falling back to bold.
 */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
});

export const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-raleway'
});
