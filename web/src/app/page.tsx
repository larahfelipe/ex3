'use client';

import { redirect } from 'next/navigation';

import { useUser } from '@/hooks/use-user';

export default function Home() {
  const { user } = useUser();

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/sign-in');
  }
}
