'use client';

import { createContext, use, type FC } from 'react';

import { setNonce } from 'get-nonce';

import type { Children } from '@/types';

const NonceContext = createContext<string | undefined>(undefined);

type NonceProviderProps = Children & Record<'nonce', string | undefined>;

/**
 * Hands this response's CSP nonce to the components that add a `<style>` of
 * their own, which the policy refuses without it. The scroll lock behind
 * dialogs reads it through `get-nonce` rather than a prop; it is set in the
 * browser alone, where each page has one nonce, and never on the server,
 * where concurrent requests would overwrite one another's.
 */
export const NonceProvider: FC<NonceProviderProps> = ({ nonce, children }) => {
  if (typeof window !== 'undefined' && nonce !== undefined) setNonce(nonce);

  return <NonceContext value={nonce}>{children}</NonceContext>;
};

export const useNonce = () => use(NonceContext);
