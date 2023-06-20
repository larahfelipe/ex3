import type { ComponentProps } from '@/types';

import Providers from './providers';

export const metadata = {
  title: 'EX3',
  description: 'Portfolio management platform'
};

const RootLayout = ({ children }: ComponentProps) => (
  <html suppressHydrationWarning lang="en">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />

      <link rel="preconnect" href="https://fonts.gstatic.com" />

      <link
        href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </head>

    <body>
      <Providers>{children}</Providers>
    </body>
  </html>
);

export default RootLayout;
