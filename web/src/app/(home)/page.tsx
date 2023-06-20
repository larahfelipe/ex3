'use client';

import type { NextPage } from 'next';
import { redirect } from 'next/navigation';

import { Center, Spinner } from '@chakra-ui/react';

import { useAuth } from '@/hooks';

const Home: NextPage = () => {
  const { user } = useAuth();

  user?.id ? redirect('/dashboard') : redirect('/sign-in');

  return (
    <Center h="100vh">
      <Spinner size="lg" color="blackAlpha.700" />
    </Center>
  );
};

export default Home;
