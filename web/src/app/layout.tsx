import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';

import {
  APP_THEME,
  APP_THEME_COLOR,
  APP_TITLE,
  APP_TITLE_TEMPLATE
} from '@/common/constants';
import { inter, raleway } from '@/common/fonts';
import { MESSAGES } from '@/i18n/messages';
import { getRequestLocale, getServerTranslator } from '@/i18n/server';
import { AppProvider } from '@/providers/app-provider';
import type { Children } from '@/types';
import './globals.css';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: { default: APP_TITLE, template: APP_TITLE_TEMPLATE },
  description: (await getServerTranslator('navigation'))('appDescription')
});

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

  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      className={`${APP_THEME} ${inter.variable} ${raleway.variable}`}
    >
      <head>
        <meta name="theme-color" content={APP_THEME_COLOR} />

        <link rel="shortcut icon" href="favicon.png" type="image/png" />
      </head>

      <body className="font-sans">
        <AppProvider locale={locale} messages={MESSAGES[locale]}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
