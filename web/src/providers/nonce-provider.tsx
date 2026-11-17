'use client';

import { createContext, use, type FC } from 'react';

import { setNonce } from 'get-nonce';

import type { Children } from '@/types';

const NonceContext = createContext<string | undefined>(undefined);

type NonceProviderProps = Children & Record<'nonce', string | undefined>;

export const NonceProvider: FC<NonceProviderProps> = ({ nonce, children }) => {
  if (typeof window !== 'undefined' && nonce !== undefined) setNonce(nonce);

  return <NonceContext value={nonce}>{children}</NonceContext>;
};

export const useNonce = () => use(NonceContext);
