'use client';

import type { NextPage } from 'next';
import { useRouter } from 'next/navigation';

import { Center } from '@chakra-ui/react';

import { Navbar } from '@/components';
import { useAuth } from '@/hooks';

const Dashboard: NextPage = () => {
  const { user } = useAuth();

  const { push } = useRouter();

  if (!user?.id) push('/sign-in');

  return (
    <Center>
      <Navbar />
    </Center>
  );
};

export default Dashboard;
