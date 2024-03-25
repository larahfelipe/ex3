'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Sidebar } from '@/components/sidebar';
import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';

export default function Layout({ children }: Readonly<Children>) {
  const { isLoading, user } = useUser();

  const { replace } = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      replace('/sign-in');
    }
  }, [isLoading, user, replace]);

  if (isLoading || !user)
    return (
      <main className="h-lvh flex">
        <Loader2 className="m-auto size-6 animate-spin" />
      </main>
    );

  return (
    <main className="h-lvh flex flex-col sm:grid sm:grid-cols-[175px_auto]">
      <Sidebar />

      {children}
    </main>
  );
}
