'use client';

import { CacheProvider } from '@chakra-ui/next-js';
import { ChakraProvider } from '@chakra-ui/react';

import { theme } from '@/styles/theme';
import type { ComponentProps } from '@/types';

const Providers = ({ children }: ComponentProps) => (
  <CacheProvider>
    <ChakraProvider theme={theme}>{children}</ChakraProvider>
  </CacheProvider>
);

export default Providers;
