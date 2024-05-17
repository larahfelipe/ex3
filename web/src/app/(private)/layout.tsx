'use client';

import { useEffect } from 'react';

import { redirect } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Sidebar } from '@/components/sidebar';
import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';

export default function Layout({ children }: Readonly<Children>) {
  const { isLoading, user } = useUser();

  useEffect(() => {
    if (!isLoading && !user) redirect('/sign-in');
  }, [isLoading, user]);

  if (isLoading || !user)
    return (
      <main className="h-lvh flex">
        <Loader2 className="m-auto size-6 animate-spin" />
      </main>
    );

  return (
    <main className="h-lvh flex flex-col bg-gray-50 sm:grid sm:grid-cols-[175px_auto]">
      <Sidebar />

      {children}
    </main>
  );
}
