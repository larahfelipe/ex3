import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';

import {
  APP_THEME,
  APP_THEME_COLOR,
  APP_TITLE,
  APP_TITLE_TEMPLATE,
  inter,
  raleway
} from '@/common/constants';
import { AppProvider } from '@/providers/app-provider';
import type { Children } from '@/types';
import './globals.css';

export const metadata: Metadata = {
  title: { default: APP_TITLE, template: APP_TITLE_TEMPLATE },
  description: 'EX3 - Portfolio Tracker'
};

/**
 * `resizes-content` shrinks the layout viewport — and with it every `dvh` — when
 * the virtual keyboard opens, so a focused field is never left behind it.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content'
};

/**
 * Next.js stamps its scripts with the nonce of the request's CSP only while
 * rendering that request. A page prerendered at build time carries no nonce and
 * the browser blocks its scripts, so every route renders per request.
 */
export default async function RootLayout({ children }: Children) {
  await connection();

  return (
    <html
      lang="en"
      className={`${APP_THEME} ${inter.variable} ${raleway.variable}`}
    >
      <head>
        <meta name="theme-color" content={APP_THEME_COLOR} />

        <link rel="shortcut icon" href="favicon.png" type="image/png" />
      </head>

      <body className="font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
