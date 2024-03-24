'use client';

import { Sidebar } from '@/components/sidebar';
import { useUser } from '@/hooks/use-user';
import type { Children } from '@/types';
import { Loader2 } from 'lucide-react';

export default function Layout({ children }: Readonly<Children>) {
  const { user } = useUser();

  return (
    <main className="h-lvh flex flex-col sm:grid sm:grid-cols-[175px_auto]">
      <Sidebar />

      {!user ? <Loader2 className="m-auto size-6 animate-spin" /> : children}
    </main>
  );
}
