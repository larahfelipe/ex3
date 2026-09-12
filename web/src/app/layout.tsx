import type { Metadata } from 'next';
import { connection } from 'next/server';

import { inter } from '@/common/constants';
import { AppProvider } from '@/providers/app-provider';
import type { Children } from '@/types';
import './globals.css';

export const metadata: Metadata = {
  title: 'EX3',
  description: 'EX3 - Portfolio Tracker'
};

/**
 * Next.js stamps its scripts with the nonce of the request's CSP only while
 * rendering that request. A page prerendered at build time carries no nonce and
 * the browser blocks its scripts, so every route renders per request.
 */
export default async function RootLayout({ children }: Children) {
  await connection();

  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#000" />

        <link rel="shortcut icon" href="favicon.png" type="image/png" />

        <link rel="manifest" href="/manifest.json" />
      </head>

      <body className={inter.className}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
