import type { Children } from '@/types';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <main className="flex min-h-dvh flex-col px-6 py-12">
        <div className="m-auto w-full max-w-100 space-y-10 duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2">
          {children}
        </div>
      </main>

      <div className="relative bg-[url('/login-hero.jpeg')] bg-cover bg-center before:absolute before:inset-y-0 before:left-0 before:w-24 before:bg-linear-to-r before:from-background before:to-transparent max-lg:hidden" />
    </div>
  );
}
