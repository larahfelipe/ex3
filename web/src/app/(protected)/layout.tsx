'use client';

import { Loader2 } from 'lucide-react';

import { Sidebar } from '@/components/sidebar';
import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';

export default function Layout({ children }: Children) {
  const { isLoading } = useUser();

  if (isLoading)
    return (
      <main className="h-screen flex">
        <Loader2 className="m-auto size-6 animate-spin" />
      </main>
    );

  return (
    <main className="h-full flex flex-col bg-black sm:grid sm:grid-cols-[160px_auto]">
      <Sidebar />

      {children}
    </main>
  );
}
