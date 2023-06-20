'use client';

import { Toaster } from 'react-hot-toast';

import { CacheProvider } from '@chakra-ui/next-js';
import { ChakraProvider } from '@chakra-ui/react';

import { AuthProvider } from '@/providers';
import { theme } from '@/styles/theme';
import type { ComponentProps } from '@/types';

const Providers = ({ children }: ComponentProps) => (
  <CacheProvider>
    <ChakraProvider theme={theme}>
      <Toaster position="top-right" />

      <AuthProvider>{children}</AuthProvider>
    </ChakraProvider>
  </CacheProvider>
);

export default Providers;
