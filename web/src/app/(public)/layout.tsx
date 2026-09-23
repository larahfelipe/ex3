/* eslint-disable react/jsx-newline */
import Link from 'next/link';

import type { Children } from '@/types';

import pkg from '../../../package.json';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <main className="relative flex min-h-dvh flex-col justify-center px-6 pt-10 pb-24">
        <div className="mx-auto w-full max-w-100 space-y-10 duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2">
          {children}
        </div>

        <footer className="absolute inset-x-0 bottom-4 flex justify-center">
          <Link
            href={pkg.author.url}
            rel="noopener noreferrer"
            className="rounded-sm text-xs text-muted-foreground ring-offset-background transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            © {pkg.author.name} {new Date().getFullYear()} - v.{pkg.version}
          </Link>
        </footer>
      </main>

      <div className="relative bg-[url('/login-hero.jpeg')] bg-cover bg-center before:absolute before:inset-y-0 before:left-0 before:w-24 before:bg-linear-to-r before:from-background before:to-transparent max-lg:hidden" />
    </div>
  );
}
