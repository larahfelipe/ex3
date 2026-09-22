/* eslint-disable react/jsx-newline */
import Link from 'next/link';

import type { Children } from '@/types';

import pkg from '../../../package.json';

export default function Layout({ children }: Children) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-2">
      <main className="min-h-dvh flex flex-col justify-center relative space-y-8 pb-16">
        {children}

        <footer className="absolute bottom-3 self-center">
          <Link
            href={pkg.author.url}
            rel="noopener noreferrer"
            className="rounded-sm text-sm text-muted-foreground ring-offset-background transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            © {pkg.author.name} {new Date().getFullYear()} - v.{pkg.version}
          </Link>
        </footer>
      </main>

      <div className="max-lg:hidden bg-[url('/login-hero.jpeg')] bg-cover bg-center" />
    </div>
  );
}
