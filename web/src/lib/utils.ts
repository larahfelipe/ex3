import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * react-hook-form rethrows what the submit handler threw once it has recorded
 * the failure in isSubmitSuccessful, and the mutation's onError has already
 * shown it, so the rejection has no handler left and would reach the console.
 */
export const withSettledRejection =
  <A extends unknown[]>(run: (...args: A) => Promise<unknown>) =>
  (...args: A) => {
    void run(...args).catch(() => undefined);
  };
