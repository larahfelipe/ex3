import type { Metadata } from 'next';

import { getServerTranslator } from '@/i18n/server';
import type { Children } from '@/types';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('assetImport')
});

export default function Layout({ children }: Children) {
  return children;
}
