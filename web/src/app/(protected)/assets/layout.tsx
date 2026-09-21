import type { Metadata } from 'next';

import { APP_TITLE_TEMPLATE } from '@/common/constants';
import type { Children } from '@/types';

export const metadata: Metadata = {
  title: { default: 'Assets', template: APP_TITLE_TEMPLATE }
};

export default function Layout({ children }: Children) {
  return children;
}
