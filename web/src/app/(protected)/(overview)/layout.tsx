import type { Metadata } from 'next';

import type { Children } from '@/types';

export const metadata: Metadata = {
  title: 'Overview'
};

export default function Layout({ children }: Children) {
  return children;
}
