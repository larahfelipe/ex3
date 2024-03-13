'use client';

import { useEffect } from 'react';

import { redirect } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { useUser } from '@/hooks/use-user';

export default function Home() {
  const { user } = useUser();

  useEffect(() => {
    if (user) {
      redirect('/dashboard');
    } else {
      redirect('/auth/sign-in');
    }
  }, [user]);

  return (
    <div className="h-lvh flex">
      <Loader2 className="m-auto animate-spin" />
    </div>
  );
}
