import type { Metadata } from 'next';

import { inter } from '@/common/constants';
import { AppProvider } from '@/providers/app-provider';
import type { Children } from '@/types';
import './globals.css';

export const metadata: Metadata = {
  title: 'EX3',
  description: 'EX3 - Portfolio Tracker'
};

export default function RootLayout({ children }: Readonly<Children>) {
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
