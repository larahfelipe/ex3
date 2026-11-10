import type { Metadata } from 'next';

import { APP_TITLE_TEMPLATE } from '@/common/constants';
import { getServerTranslator } from '@/i18n/server';
import type { Children } from '@/types';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: {
    default: (await getServerTranslator('navigation.pages'))('assets'),
    template: APP_TITLE_TEMPLATE
  }
});

export default function Layout({ children }: Children) {
  return children;
}
