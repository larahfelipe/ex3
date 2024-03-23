import { Sidebar } from '@/components/sidebar';
import type { Children } from '@/types';

export default function Layout({ children }: Readonly<Children>) {
  return (
    <main className="h-lvh flex flex-col sm:grid sm:grid-cols-[175px_auto]">
      <Sidebar />

      {children}
    </main>
  );
}
